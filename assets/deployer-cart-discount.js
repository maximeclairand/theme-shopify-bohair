if (!customElements.get('deployer-cart-discount')) {
  customElements.define(
    'deployer-cart-discount',

    class DeployerCartDiscount extends HTMLElement {
      constructor() {
        super();
        this.applyButton = this.querySelector('.deployer-cart-discount_button');
        this.input = this.querySelector('.deployer-cart-discount_input');

        //Connect Listeners
        this.applyButton.addEventListener('click', this.submitDiscount.bind(this));
        this.querySelector('.cart-discount__remove-discount').addEventListener('click', this.removeDiscount.bind(this));
        this.addEventListener('discount:remove', this.removeDiscount.bind(this));
        if (this.querySelector('.deployer-cart-discount_auto-add-product')) this.handleAutoAddProduct();
      }

      async submitDiscount(event) {
        event.preventDefault();
        this.applyButton.disabled = true;
        if (localStorage.getItem('discountCode') != null) {
          this.removeDiscount();
          return;
        }
        const discountCode = this.input.value;
        if (discountCode === '') {
          this.setErrorMode('Veuillez saisir un code');
        } else {
          this.applyCode(discountCode);
        }
      }

      async removeDiscount() {
        if (this.querySelector('.cart-discount_badge').classList.contains('loading')) return;

        this.setButtonLoading();
        this.querySelector('.cart-discount_badge').classList.add('loading');

        localStorage.removeItem('discountCode');

        try {
          await window.DeployerStorefrontApi.removeDiscountCodes();

          setTimeout(() => {
            this.updateCart(null);
            this.setButtonLoaded();
          }, 200);
        } catch (error) {
          console.error('Erreur lors de la suppression du code de réduction:', error);
          this.setButtonLoaded();
          this.querySelector('.cart-discount_badge').classList.remove('loading');
        }
      }

      async applyCode(discountCode) {
        this.setButtonLoading();
        try {
          // Appliquer le code de réduction via le SDK
          const result = await window.DeployerStorefrontApi.applyDiscountCode(discountCode);

          if (result.cartDiscountCodesUpdate) {
            // Vérifier s'il y a des erreurs
            if (result.cartDiscountCodesUpdate.userErrors && result.cartDiscountCodesUpdate.userErrors.length > 0) {
              const errorMessage = result.cartDiscountCodesUpdate.userErrors[0].message;
              this.setErrorMode(errorMessage || 'Code non valide');
              this.removeDiscount();
              return;
            }

            // Vérifier si le code a été appliqué avec succès
            const updatedCart = result.cartDiscountCodesUpdate.cart;
            const appliedDiscount = updatedCart.discountCodes.find((dc) => dc.code.toLowerCase() === discountCode.toLowerCase());

            if (appliedDiscount && appliedDiscount.applicable) {
              let localStorageValue = {
                code: discountCode.trim(),
                totalCart: updatedCart.cost.totalAmount.amount,
              };
              localStorage.setItem('discountCode', JSON.stringify(localStorageValue));

              // Mettre à jour l'état du bouton immédiatement
              this.setButtonLoaded();

              // Encapsuler les événements de rafraîchissement dans le setTimeout
              // pour s'assurer que le localStorage est bien mis à jour avant
              setTimeout(() => {
                this.refreshCart();
              }, 500);
            } else {
              this.setErrorMode('Code non applicable');
              this.removeDiscount();
            }
          } else {
            this.setErrorMode("Erreur lors de l'application du code");
            this.removeDiscount();
          }
        } catch (error) {
          console.error("Erreur lors de l'application du code de réduction:", error);
          this.setErrorMode('Une erreur est survenue');
          this.removeDiscount();
        }
      }

      /**
       * Rafraîchit le panier et les composants associés
       * @param {boolean} isCartPage - Si true, recharge la page si on est sur la page panier
       */
      refreshCart(isCartPage = true) {
        // Deployer Cart Drawer
        document.dispatchEvent(new CustomEvent('deployer-cart-drawer:refresh'));

        // Cart Drawer Thème Impact & Prestige
        document.documentElement.dispatchEvent(
          new CustomEvent('cart:refresh', {
            bubbles: true,
          })
        );

        // Cart page
        if (isCartPage && window.location.pathname.includes('/cart')) {
          window.location.reload();
        }
      }

      setErrorMode(message = 'Veuillez saisir un code valide') {
        // Reset the button state
        this.applyButton.disabled = false;
        this.applyButton.classList.remove('deployer-button--is-loading');
        // Set the input in error mode
        this.input.focus();
        this.input.classList.add('deployer-cart-discount_input-error');
        this.input.placeholder = message;
        this.input.value = '';
        setTimeout(() => {
          this.input.classList.remove('deployer-cart-discount_input-error');
          this.input.placeholder = this.input.dataset.defaultPlaceholder;
        }, 2000);
      }

      setButtonLoading() {
        this.applyButton.disabled = true;
        this.applyButton.classList.add('deployer-button--is-loading');
      }

      setButtonLoaded() {
        this.applyButton.disabled = false;
        this.applyButton.classList.remove('deployer-button--is-loading');
      }

      async updateCart(discount) {
        return await fetch(window.Shopify.routes.root + 'cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attributes: {
              discount: discount,
            },
            sections: 'deployer-cart-drawer',
            sections_url: window.location.pathname,
          }),
        }).then(() => {
          // Deployer Cart Drawer
          document.dispatchEvent(new CustomEvent('deployer-cart-drawer:refresh'));

          // Cart Drawer Thème Impact & Prestige
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:refresh', {
              bubbles: true,
            })
          );

          // Cart page
          if (window.location.pathname.includes('/cart')) {
            window.location.reload();
          }

          // Generic Cart Drawer Refresh -> Si le thème n'a pas de fonction ou d'évenement pour rafraichir le panier
          // const cartDrawerSection = deployerAdapter.cartDrawerSection || 'cart-drawer'; //shopify-section-cart-drawer = cart-drawer
          // const cartDrawerWebComponent = deployerAdapter.cartDrawerWebComponent || 'cart-drawer';
          // fetch(window.Shopify.routes.root + '?sections=' + cartDrawerSection)
          //   .then((res) => res.json())
          //   .then((data) => {
          //     document.querySelector(cartDrawerWebComponent).innerHTML = new DOMParser().parseFromString(data[cartDrawerSection], 'text/html').querySelector(cartDrawerWebComponent).innerHTML;
          //   });
        });
      }

      handleAutoAddProduct() {
        const discount_prefix = this.querySelector('.deployer-cart-discount_auto-add-product').dataset.prefix.toLowerCase();
        const product_to_add = this.querySelector('.deployer-cart-discount_auto-add-product').dataset.productToAdd;
        var product_already_in_cart = false;
        fetch('/cart.js')
          .then((response) => response.json())
          .then((data) => {
            data.items.forEach((item) => {
              if (item.id == product_to_add) {
                product_already_in_cart = true;
              }
            });
          })
          .then(() => {
            if (localStorage.getItem('discountCode') == null || product_already_in_cart) return;
            const discount_code = JSON.parse(localStorage.getItem('discountCode')).code.toLowerCase();
            if (discount_code.includes(discount_prefix)) {
              fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: [
                    {
                      id: product_to_add,
                      quantity: 1,
                    },
                  ],
                }),
              }).then(() => {
                document.dispatchEvent(new CustomEvent('deployer-cart-drawer:refresh'));
              });
            }
          });
      }
    }
  );
}
