const deployerEvents = {
  variantChange: 'variant:change',
};

class DeployerElement extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.setupVariables();
    this.setupEvents();
  }

  setupVariables() {
    throw new Error('setupVariables is not implemented');
  }

  setupEvents() {
    throw new Error('setupEvents is not implemented');
  }
}

window.customElements.define('deployer-element', DeployerElement);

class DeliveryEstimation extends DeployerElement {
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.init();
  }

  setupVariables() {
    this.shopLocale = this.dataset.shopLocale;

    this.delivery = {
      container: this.querySelector('.delivery-estimation__delay-container'),
      delayContainer: this.querySelector('.delivery-estimation__delay-container'),
      minimumDelay: this.querySelector('#datemin'),
      maximumDelay: this.querySelector('#datemax'),
      countdown: this.querySelector('#countdown'),
    };

    this.translation = JSON.parse(this.querySelector('[type="application/json"]').textContent);
  }

  setupEvents() {
    document.addEventListener(deployerEvents.variantChange, (event) => {
      this.currentVariantId = event.detail.variant.id;
      this.init();
    });
  }

  init() {
    this.updateDeliveryDelay();

    if (this.delivery.countdown) {
      this.startCountdown();
    }
  }

  updateDeliveryDelay() {
    const today = new Date();
    let datesDelai;

    if (this.delivery.delayContainer.dataset.max === '0') {
      datesDelai = this.getDatesDelai(today, parseInt(this.delivery.delayContainer.dataset.min));
    } else {
      datesDelai = this.getDatesDelai(today, parseInt(this.delivery.delayContainer.dataset.min), parseInt(this.delivery.delayContainer.dataset.max));
    }

    this.delivery.minimumDelay.innerHTML = this.formatDate(datesDelai['dmin']);

    if (this.delivery.delayContainer.dataset.max !== '0') {
      this.delivery.maximumDelay.innerHTML = this.formatDate(datesDelai['dmax']);
    }
  }

  /**
   * @param {Date} date
   * @returns {String}
   */
  formatDate(date) {
    const options = { weekday: 'short', month: 'numeric', day: 'numeric' };
    return new Date(date).toLocaleDateString(this.dataset.shopLocale, options);
  }

  /**
   * @param {Date} date
   * @param {Number} delaiMin
   * @param {Number} delaiMax
   * @returns {Object}
   */
  getDatesDelai(date, delaiMin, delaiMax = delaiMin) {
    const result = {};
    const currentDay = date.getDay();
    const currentHour = date.getHours();

    let minDelay = delaiMin;
    let maxAdditionalDelay = delaiMax;

    switch (currentDay) {
      case 0: // Dimanche
        minDelay = delaiMin + 2; // (J+2)
        break;

      case 1: // Lundi
        minDelay = delaiMin + 1; // (J+2)
        maxAdditionalDelay = delaiMax; // (J+1)
        break;

      case 2: // Mardi
        currentHour < 12
          ? (minDelay = delaiMin) // (J+1)
          : (minDelay = delaiMin + 1); // (J+2)
        break;

      case 3: // Mercredi
        currentHour < 12
          ? (minDelay = delaiMin) // (J+1)
          : (minDelay = delaiMin + 1); // (J+2)
        break;

      case 4: // Jeudi
        currentHour < 12
          ? (minDelay = delaiMin) // (J+1)
          : (minDelay = delaiMin + 1); // (J+2) et (J+3)
        break;

      case 5: // Vendredi
        currentHour < 12
          ? (minDelay = delaiMin && maxAdditionalDelay++) // (J+1) et (J+2)
          : (minDelay = delaiMin + 3); // (J+3)
        break;

      case 6: // Samedi
        minDelay = delaiMin + 3; // (J+3)
        break;

      default:
        minDelay = delaiMin;
    }

    result.dmin = this.addBusinessDays(date, minDelay);
    result.dmax = this.addBusinessDays(result['dmin'], maxAdditionalDelay);

    return result;
  }

  /**
   *
   * @param {Date} startDate
   * @param {Number} numberOfBusinessDays
   * @returns {Date}
   */
  addBusinessDays(startDate, numberOfBusinessDays) {
    let date = new Date(startDate.getTime());
    while (numberOfBusinessDays > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0) {
        numberOfBusinessDays--;
      }
    }
    return date;
  }
}
window.customElements.define('delivery-estimation', DeliveryEstimation);
