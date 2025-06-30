if (!customElements.get('subscription-widget')) {
  customElements.define(
    'subscription-widget',
    class SubscriptionWidget extends HTMLElement {
      constructor() {
        super();

        this.main_product_form = this.closest('.product').querySelector('.product-form form[action*="/cart/add"]') || document.querySelector('.product__page form[action*="/cart/add"]') || document.querySelector('.product form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add.js"]') || document.querySelector('form[action*="/cart/add"]');
        this.currentVariant = JSON.parse(this.querySelector('#currentVariantData').textContent);
        this.sectionId = this.dataset.sectionId;

        this.sellingPlanFormInput;
        if (!this.main_product_form.querySelector('input[name="selling_plan"]')) {
          this.sellingPlanFormInput = document.createElement('input');
          this.sellingPlanFormInput.setAttribute('type', 'hidden');
          this.sellingPlanFormInput.setAttribute('name', 'selling_plan');
          this.main_product_form.appendChild(this.sellingPlanFormInput);
        } else {
          this.sellingPlanFormInput = this.main_product_form.querySelector('input[name="selling_plan"]');
        }
        this.sellingPlanFormInput.setAttribute('value', '');

        // update when variant changes (works with Broadcast, Prestige, Dawn & co, Impulse)
        if (this.main_product_form.querySelector('input[name="id"]') !== null) {
          this.main_product_form.querySelector('input[name="id"]').addEventListener('change', (event) => {
            this.handleVariantChange(event.target.value);
          });
        } else {
          if (typeof subscribe === 'function') {
            this.variantChangeSubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
              this.handleVariantChange(event.data.variant.id);
            });
          } else {
            document.addEventListener('variant:change', (event) => {
              this.handleVariantChange(event.detail.variant.id);
            });
          }
        }
      }

      connectedCallback() {
        // update when purchase type changes
        this.querySelectorAll('input[name="purchase_type"]').forEach((input) => {
          input.addEventListener('change', this.handleSellingPlanInput.bind(this));
        });

        // update when selling plan changes
        if (this.querySelector('.deployer-select')) {
          this.querySelector('.deployer-select').addEventListener('change', this.handleSellingPlanInputChange.bind(this));
        }

        this.updateMainPrices();
      }

      handleVariantChange(variant_id) {
        this.toggleLoadingMode();
        this.renderSubscriptionWidget(variant_id);
        this.updateMainPrices();
      }

      async renderSubscriptionWidget(variant_id) {
        const productUrl = this.dataset.url;
        const requestedVariantId = variant_id;
        const sectionId = this.dataset.sectionId;
        fetch(`${productUrl}?variant=${requestedVariantId}&section_id=${sectionId}`)
          .then((response) => response.text())
          .then((responseText) => {
            const responseHtml = new DOMParser().parseFromString(responseText, 'text/html');
            const source = responseHtml.getElementById(`subscription-widget__${this.dataset.sectionId}`);
            const destination = this;
            if (source && destination) destination.innerHTML = source.innerHTML;
            destination.connectedCallback();
            this.currentVariant = JSON.parse(this.querySelector('#currentVariantData').textContent);
            this.toggleLoadingMode();
          })
          .catch((error) => {
            console.error("Erreur en tentant de rafraichir le widget d'abonnement:", error);
            this.toggleLoadingMode();
          });
      }

      handleSellingPlanInputChange(e) {
        this.updateSubscribePrices(e);
        this.handleSellingPlanInput(e);
        this.updateMainPrices();
      }

      updateSubscribePrices(e) {
        const priceContainer = this.querySelector('.subscription-widget__option--subscription .subscription-widget__option-price');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const adjustementType = selectedOption.dataset.ajustmentType;
        const adjustementValue = parseFloat(selectedOption.dataset.ajustmentValue);

        let adjustedPrice;

        switch (adjustementType) {
          case 'fixed_amount':
            adjustedPrice = this.currentVariant.price - adjustementValue;
            break;
          case 'percentage':
            adjustedPrice = this.currentVariant.price * (1 - adjustementValue / 100);
            break;
          case 'price':
            adjustedPrice = adjustementValue;
            break;
          default:
            adjustedPrice = this.currentVariant.price;
            break;
        }

        priceContainer.innerText = formatPrice(adjustedPrice);
        this.updateSubscribeSavingPercentage(adjustedPrice);
      }

      updateSubscribeSavingPercentage(finalPrice) {
        const savingPercentageContainers = this.querySelectorAll('.subscription-widget__dynamic-discount');
        const variantPrice = this.currentVariant.price / 100;
        var finalPrice = finalPrice / 100;
        if (!savingPercentageContainers || variantPrice === finalPrice) return;
        savingPercentageContainers.forEach((container) => {
          const saving = ((variantPrice - finalPrice) / variantPrice) * 100;
          container.innerText = Math.round(saving) + '%';
        });
      }

      handleSellingPlanInput(e) {
        const selectedOption = e.target.closest('.subscription-widget__option');
        if (selectedOption) {
          selectedOption.querySelector('input[name="purchase_type"]').checked = true;
          this.querySelectorAll('.subscription-widget__option').forEach((option) => option.classList.remove('subscription-widget__option--selected'));
          selectedOption.classList.add('subscription-widget__option--selected');
        }

        if (selectedOption.classList.contains('subscription-widget__option--subscription')) {
          this.sellingPlanFormInput.value = selectedOption.querySelector('.deployer-select').options[selectedOption.querySelector('.deployer-select').selectedIndex].dataset.value;
        } else {
          this.sellingPlanFormInput.removeAttribute('value');
        }

        this.updateMainPrices();
      }

      toggleLoadingMode() {
        this.classList.toggle('subscription-widget--loading');
      }

      updateMainPrices() {
        var total = '';
        if (this.querySelector('.subscription-widget__option--selected .subscription-widget__option-compare-at-price') != null) {
          var total = this.querySelector('.subscription-widget__option--selected .subscription-widget__option-compare-at-price').innerHTML;
        }
        var discountedTotal = this.querySelector('.subscription-widget__option--selected .subscription-widget__option-price').innerHTML;

        // Specifically developped for Dawn Themes:
        this.closest('.product__info-wrapper')
          .querySelectorAll('.price__container')
          .forEach((priceContainer) => {
            if (total != discountedTotal) {
              priceContainer.closest('.price').classList.add('price--on-sale');
              priceContainer.querySelector('.price__sale .price-item--regular').innerHTML = total;
              priceContainer.querySelector('.price__sale .price-item--sale').innerHTML = discountedTotal;
            } else {
              priceContainer.closest('.price').classList.remove('price--on-sale');
              priceContainer.querySelector('.price__regular .price-item--regular').innerHTML = total;
            }
          });
      }
    }
  );
}
