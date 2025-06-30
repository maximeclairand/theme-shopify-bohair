if (!customElements.get('deployer-cart-drawer')) {
  customElements.define(
    'deployer-cart-drawer',
    class DeployerCartDrawer extends HTMLElement {
      constructor() {
        super();

        this.querySelector('.deployer-cart-drawer__overlay').addEventListener('click', this.close.bind(this));
        this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());

        this.querySelector('#DeployerCartDrawer-Checkout').addEventListener('click', (event) => {
          event.target.classList.add('deployer-button--is-loading');
        });

        // Connecte le panier à l'icône du panier
        this.setHeaderCartIconAccessibility();

        // Connecte le panier aux formulaires des pages produit
        this.setProductFormCompatibility(this);

        this.connectCartItemsListeners();
      }

      connectCartItemsListeners() {
        document.addEventListener('deployer-cart-drawer:refresh', () => {
          this.refreshCart();
        });

        document.querySelectorAll('.deployer-cart-drawer__item').forEach((cart_item) => {
          // Clic sur le bouton supprimer
          const cart_item_remove_button = cart_item.querySelector('.deployer-cart-drawer__item-remove');
          if (cart_item_remove_button) {
            cart_item_remove_button.addEventListener('click', (event) => {
              event.preventDefault();
              this.updateLineItemQuantity(cart_item_remove_button.dataset.index, 0);
            });
          }

          const cart_item_input = cart_item.querySelector('.deployer-quantity input');

          // Mise à jour de l'input de quantité
          cart_item_input.addEventListener('change', () => {
            this.updateLineItemQuantity(cart_item_input.dataset.index, cart_item_input.value);
          });

          // Clic sur les boutons de quantité
          cart_item.querySelectorAll('.deployer-quantity button:not(:disabled)').forEach((button) => {
            button.addEventListener('click', (event) => {
              this.onQuantityButtonClick(event, cart_item_input);
            });
          });

          // Ajout d'abonnement
          cart_item.querySelectorAll('.deployer-cart-drawer__item-selling-add-plan-button').forEach((button) => {
            button.addEventListener('click', (event) => {
              event.target.querySelector('.deployer-button-text').classList.add('hidden');
              if (event.target.querySelector('svg.icon-arrow') !== null) event.target.querySelector('svg.icon-arrow').classList.add('hidden');
              event.target.querySelector('.loading__spinner').classList.remove('hidden');
              this.onAddSellingPlanButtonClick(event, cart_item_input.value, cart_item_input.dataset.index);
            });
          });

          // Modifier la fréquence d'un abonnement
          cart_item.querySelectorAll('select[name="plan-select"]').forEach((select) => {
            select.addEventListener('change', (event) => {
              this.onSellingPlanChange(event, cart_item_input.value, cart_item_input.dataset.index);
            });
          });
        });
      }

      setHeaderCartIconAccessibility() {
        if (window.deployerAdapter.cartIcon) {
          window.deployerAdapter.cartIcon.addEventListener('click', (event) => {
            event.preventDefault();
            this.open();
          });
        } else {
          console.error('Icône du panier non trouvée');
        }
      }

      // Intercepte les ajouts au panier pour les envoyer à la méthode de rendu du panier
      setProductFormCompatibility(cartDrawer) {
        document.querySelectorAll('form[action="/cart/add"]').forEach((form) => {
          form.querySelectorAll('[name="add"]').forEach((button) => {
            button.addEventListener('click', function (event) {
              event.preventDefault(), event.stopPropagation();

              if (button.getAttribute('aria-disabled') === 'true') return;

              button.setAttribute('aria-disabled', true);
              button.classList.add('deployer-button--is-loading');

              const config = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: `application/javascript` },
              };
              config.headers['X-Requested-With'] = 'XMLHttpRequest';
              delete config.headers['Content-Type'];

              const formData = new FormData(button.closest('form'));

              formData.append(
                'sections',
                document
                  .querySelector('deployer-cart-drawer')
                  .getSectionsToRender()
                  .map((section) => section.section)
              );
              formData.append('sections_url', window.location.pathname);

              config.body = formData;

              fetch('/cart/add', config)
                .then((response) => response.json())
                .then((response) => {
                  if (response.status) {
                    document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message: response.description } }));
                    return;
                  }
                  document.querySelector('deployer-cart-drawer').renderCartContents(response);
                  document.querySelectorAll('.quick-add-modal_slider-cross-sells').forEach((modalCrossSell) => modalCrossSell.hide());
                })
                .catch((e) => {
                  console.error(e);
                  document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message: "Erreur d'ajout au panier" } }));
                })
                .finally(() => {
                  button.classList.remove('deployer-button--is-loading');
                  button.removeAttribute('aria-disabled');
                });
            });
          });
        });
      }

      open() {
        // here the animation doesn't seem to always get triggered. A timeout seem to help
        setTimeout(() => {
          this.classList.add('animate', 'active');
        });
        window.deployerAdapter.containerToAvoidScroll.classList.add(window.deployerAdapter.classToAvoidScroll);
      }

      close() {
        this.classList.remove('active');
        window.deployerAdapter.containerToAvoidScroll.classList.remove(window.deployerAdapter.classToAvoidScroll);
        if (window.deployerAdapter.containerToAvoidScroll.style.overflow === 'hidden') {
          window.deployerAdapter.containerToAvoidScroll.style.overflow = 'auto';
        }
      }

      getSectionsToRender() {
        const cartContainerSectionId = window.deployerAdapter.cartIcon.closest('.shopify-section').id.replace('shopify-section-', '');
        return [
          {
            id: 'deployer-cart-drawer',
            section: 'deployer-cart-drawer',
            selector: '.deployer-cart-drawer__inner',
          },
          {
            id: cartContainerSectionId,
            section: cartContainerSectionId,
            selector: window.deployerAdapter.cartIconSelector,
          },
        ];
      }

      renderCartContents(parsedState) {
        this.getSectionsToRender().forEach((section) => {
          const sectionElement = section.selector ? document.querySelector(section.selector) : document.getElementById(section.id);
          const temporaryDom = new DOMParser().parseFromString(parsedState.sections[section.id], 'text/html');
          if (temporaryDom.querySelector(section.selector)) {
            sectionElement.innerHTML = temporaryDom.querySelector(section.selector).innerHTML;
          } else {
            sectionElement.innerHTML = temporaryDom.querySelector('.shopify-section').innerHTML;
          }
        });

        setTimeout(() => {
          this.open();
          this.connectCartItemsListeners();
          if (parsedState.item_count == 0) {
            this.classList.add('deployer-cart-drawer--empty');
          } else {
            this.classList.remove('deployer-cart-drawer--empty');
          }
        });
      }

      refreshCart() {
        // Ne met pas à jour la pastille de l'icone du panier. Mise à jour à prévoir
        fetch(window.Shopify.routes.root + '?sections=deployer-cart-drawer')
          .then((res) => res.json())
          .then((data) => {
            this.innerHTML = new DOMParser().parseFromString(data['deployer-cart-drawer'], 'text/html').querySelector('deployer-cart-drawer').innerHTML;
            setTimeout(() => {
              this.connectCartItemsListeners();
            });
          });
      }

      onQuantityButtonClick(event, cart_item_input) {
        event.preventDefault();
        const previousValue = cart_item_input.value;

        event.target.name === 'plus' ? cart_item_input.stepUp() : cart_item_input.stepDown();
        if (previousValue !== cart_item_input.value) {
          let timeout;
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            this.updateLineItemQuantity(cart_item_input.dataset.index, cart_item_input.value);
          }, 300);
        }
      }

      updateLineItemQuantity(line, quantity) {
        this.enableLoading(line);

        const body = JSON.stringify({
          line,
          quantity,
          sections: this.getSectionsToRender().map((section) => section.section),
          sections_url: window.location.pathname,
        });

        fetch('/cart/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: `application/json` },
          ...{ body },
        })
          .then((response) => {
            return response.text();
          })
          .then((state) => {
            const parsedState = JSON.parse(state);
            const quantityElement = document.getElementById(`DeployerCartDrawer-Quantity-${line}`);

            if (parsedState.errors) {
              quantityElement.value = quantityElement.getAttribute('value');
              this.setLineItemError(line, parsedState.errors);
              return;
            }

            this.renderCartContents(parsedState);
          })
          .catch((e) => {
            console.error(e);
            this.setCartError('Une erreur est survenue lors de l’actualisation de votre panier. Veuillez réessayer.');
            this.disableLoading(line);
          })
          .finally(() => {
            this.disableLoading(line);
          });
      }

      onAddSellingPlanButtonClick(event, quantity, line) {
        event.preventDefault();
        const firstSellingPlanId = event.target.dataset.planId;
        this.addLineItemSellingPlan(line, quantity, firstSellingPlanId);
      }

      onSellingPlanChange(event, quantity, line) {
        event.preventDefault();
        const firstSellingPlanId = event.target.value;
        this.addLineItemSellingPlan(line, quantity, firstSellingPlanId);
      }

      addLineItemSellingPlan(line, quantity, planId) {
        this.enableLoading(line);

        const body = JSON.stringify({
          line,
          quantity,
          selling_plan: planId,
          sections: this.getSectionsToRender().map((section) => section.section),
          sections_url: window.location.pathname,
        });

        fetch('/cart/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: `application/json` },
          ...{ body },
        })
          .then((response) => {
            return response.text();
          })
          .then((state) => {
            const parsedState = JSON.parse(state);
            const quantityElement = document.getElementById(`DeployerCartDrawer-Quantity-${line}`);

            if (parsedState.errors) {
              quantityElement.value = quantityElement.getAttribute('value');
              this.setLineItemError(line, parsedState.errors);
              return;
            }

            this.classList.toggle('deployer-cart-drawer--empty', parsedState.item_count === 0);

            this.renderCartContents(parsedState);
          })
          .catch((e) => {
            console.error(e);
            this.setCartError('Une erreur est survenue lors de l’actualisation de votre panier. Veuillez réessayer.');
            this.disableLoading(line);
          })
          .finally(() => {
            this.disableLoading(line);
          });
      }

      setLineItemSellingPlan(line, quantity, planId) {
        this.enableLoading(line);

        const body = JSON.stringify({
          line,
          quantity,
          selling_plan: planId,
          sections: this.getSectionsToRender().map((section) => section.section),
          sections_url: window.location.pathname,
        });

        fetch('/cart/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: `application/json` },
          ...{ body },
        })
          .then((response) => {
            return response.text();
          })
          .then((state) => {
            const parsedState = JSON.parse(state);
            const quantityElement = document.getElementById(`DeployerCartDrawer-Quantity-${line}`);

            if (parsedState.errors) {
              quantityElement.value = quantityElement.getAttribute('value');
              this.setLineItemError(line, parsedState.errors);
              return;
            }

            this.classList.toggle('deployer-cart-drawer--empty', parsedState.item_count === 0);

            this.renderCartContents(parsedState);
          })
          .catch((e) => {
            console.error(e);
            this.setCartError('Une erreur est survenue lors de l’actualisation de votre panier. Veuillez réessayer.');
            this.disableLoading(line);
          })
          .finally(() => {
            this.disableLoading(line);
          });
      }

      setLineItemError(line, message) {
        if (document.querySelector('deployer-toast-notification')) {
          document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message: message } }));
          return;
        }
        const lineItemError = document.getElementById(`DeployerCartDrawer-LineItemError-${line}`);
        if (lineItemError) lineItemError.querySelector('.deployer-cart-drawer__item-error-text').innerHTML = message;
      }

      setCartError(message) {
        if (document.querySelector('deployer-toast-notification')) {
          document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message: message } }));
          return;
        }
        document.getElementById('DeployerCartDrawer-CartErrors').textContent = message;
      }

      enableLoading(line) {
        const mainCartItems = document.querySelector('.deployer-cart-drawer__items');
        mainCartItems.classList.add('deployer-cart-drawer__items--disabled');
        const cartDrawerItemElements = this.querySelectorAll(`#DeployerCartDrawer-Item-${line} .loading__spinner`);
        cartDrawerItemElements.forEach((overlay) => overlay.classList.remove('hidden'));
        if (document.querySelector('.deployer-cart-drawer__totals-value') != null) {
          document.querySelector('.deployer-cart-drawer__totals-value').classList.add('deployer-loading');
        }
        if (document.querySelector('.deployer-cart-drawer__reductions-value')) {
          document.querySelector('.deployer-cart-drawer__reductions-value').classList.add('deployer-loading');
        }
        document.querySelector(`#DeployerCartDrawer-Item-${line} .deployer-cart-drawer__item-prices`).classList.add('deployer-loading');
      }

      disableLoading(line) {
        const mainCartItems = document.querySelector('.deployer-cart-drawer__items');
        mainCartItems.classList.remove('deployer-cart-drawer__items--disabled');
        const cartDrawerItemElements = this.querySelectorAll(`#DeployerCartDrawer-Item-${line} .loading__spinner`);
        cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
        if (document.querySelector('.deployer-cart-drawer__totals-value') != null) {
          document.querySelector('.deployer-cart-drawer__totals-value').classList.remove('deployer-loading');
        }
        if (document.querySelector('.deployer-cart-drawer__reductions-value')) {
          document.querySelector('.deployer-cart-drawer__reductions-value').classList.remove('deployer-loading');
        }
        if (document.querySelector(`#DeployerCartDrawer-Item-${line}`)) {
          document.querySelector(`#DeployerCartDrawer-Item-${line} .deployer-cart-drawer__item-prices`).classList.remove('deployer-loading');
        }
      }
    }
  );
}

class DeployerCartNote extends HTMLElement {
  constructor() {
    super();

    let inputTimeout;
    this.addEventListener('input', (event) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        const body = JSON.stringify({ note: event.target.value });
        fetch('/cart/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: body,
        });
      }, 300);
    });
  }
}

if (!customElements.get('deployer-cart-note')) customElements.define('deployer-cart-note', DeployerCartNote);
