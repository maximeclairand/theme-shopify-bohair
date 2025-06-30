if (!customElements.get('deployer-slider-component')) {
  customElements.define(
    'deployer-slider-component',
    class DeployerSliderComponent extends HTMLElement {
      constructor() {
        super();

        this.slider = this.querySelector('[data-slider]');
        this.slides = this.querySelectorAll('[data-slide]');
        this.firstSlide = this.slider.querySelector('[data-slide]');
        this.enableDraggingMobile = this.querySelector('[data-drag-mobile]');
        this.enableDraggingDesktop = this.querySelector('[data-drag-desktop]');
        this.enableFreeScrollMobile = this.querySelector('[data-free-scroll-mobile]');
        this.enableFreeScrollDesktop = this.querySelector('[data-free-scroll-desktop]');
        this.enableLoop = this.querySelector('[data-loop]');
        this.enableAutoplay = this.querySelector('[data-autoplay]');
        this.autoplaySpeed = this.querySelector('[data-speed]');
        this.autoplayButton = this.querySelector('[data-autoplay-button]');
        this.prevButtons = this.querySelectorAll('button[name="previous"]');
        this.nextButtons = this.querySelectorAll('button[name="next"]');
        this.currentPageElement = this.querySelector('[data-page-current]');
        this.pageTotalElement = this.querySelector('[data-page-total]');
        this.navigationLinks = this.querySelectorAll('[data-navigation-link]');
        this.navigationLinksArray = Array.from(this.navigationLinks);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.direction = this.slider.dataset.direction;

        if (!this.slider) return;

        this.initDirection();
        this.initPages();
        const resizeObserver = new ResizeObserver((entries) => this.initPages());
        resizeObserver.observe(this.slider);

        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButtons.forEach((button) => button.addEventListener('click', this.onButtonClick.bind(this)));
        this.nextButtons.forEach((button) => button.addEventListener('click', this.onButtonClick.bind(this)));
        this.navigationLinksArray.forEach((link) => link.addEventListener('click', this.onLinkClick.bind(this)));
        this.reducedMotion.addEventListener('change', () => {
          if (this.enableAutoplay) this.setAutoPlay();
        });

        this.setDragging();
        if (this.enableAutoplay) this.setAutoPlay();
      }

      get step() {
        let step = 1;

        if (window.innerWidth < 750) {
          step = this.slider.dataset.stepMobile;
        } else if (window.innerWidth < 1025) {
          step = this.slider.dataset.stepTablet;
        } else {
          step = this.slider.dataset.stepDesktop;
        }

        return step !== undefined ? parseFloat(step) : 1;
      }

      initDirection() {
        this.sliderSlideOffset = this.slides[1].offsetLeft - this.slides[0].offsetLeft;

        if (this.direction === 'right') {
          this.slideScrollPosition = this.slider.scrollLeft + this.slides.length * this.sliderSlideOffset;
          this.setSlidePosition(this.slideScrollPosition);
        }
      }

      initPages() {
        this.slidesToShow = Array.from(this.slides).filter((element) => element.clientWidth > 0);
        if (this.slidesToShow.length < 2) return;
        this.sliderSlideOffset = this.slidesToShow[1].offsetLeft - this.slidesToShow[0].offsetLeft;
        this.slidesPerPage = Math.floor((this.slider.clientWidth - this.slidesToShow[0].offsetLeft) / this.sliderSlideOffset);
        this.totalPages = this.slidesToShow.length - this.slidesPerPage + 1;
        this.update();
      }

      resetPages() {
        this.slides = this.querySelectorAll('[data-slide]');
        this.initPages();
      }

      update() {
        if (!this.slider) return;

        const previousPage = this.currentPage;
        this.currentPage = Math.round(this.slider.scrollLeft / this.sliderSlideOffset) + 1;

        // Dispatches slide changed event
        if (this.currentPage != previousPage) {
          this.dispatchEvent(
            new CustomEvent('deployerSlideChanged', {
              detail: {
                currentPage: this.currentPage,
                currentElement: this.slidesToShow[this.currentPage - 1],
              },
            })
          );
        }

        // If loop is enabled, we don't need to update the buttons
        if (!this.enableLoop) {
          // Updates navigation buttons
          if (this.isSlideVisible(this.slidesToShow[0]) && this.slider.scrollLeft === 0) {
            this.prevButtons.forEach((button) => button.setAttribute('disabled', 'disabled'));
          } else {
            this.prevButtons.forEach((button) => button.removeAttribute('disabled'));
          }

          if (this.isSlideVisible(this.slidesToShow[this.slidesToShow.length - 1])) {
            this.nextButtons.forEach((button) => button.setAttribute('disabled', 'disabled'));
          } else {
            this.nextButtons.forEach((button) => button.removeAttribute('disabled'));
          }
        }

        // Updates navigation numbering
        if (this.currentPageElement && this.pageTotalElement) {
          this.currentPageElement.textContent = this.currentPage;
          this.pageTotalElement.textContent = this.totalPages;
        }

        // Updates navigation links
        if (this.navigationLinks.length) {
          this.navigationLinks.forEach((link) => {
            link.classList.remove('deployer-slider-link--active');
            link.removeAttribute('aria-current');
          });
          this.navigationLinks[this.currentPage - 1].classList.add('deployer-slider-link--active');
          this.navigationLinks[this.currentPage - 1].setAttribute('aria-current', true);
        }
      }

      isSlideVisible(element, offset = 0) {
        const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
        return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
      }

      onButtonClick(event) {
        event.preventDefault();
        this.slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + this.step * this.sliderSlideOffset : this.slider.scrollLeft - this.step * this.sliderSlideOffset;

        if (this.enableLoop) {
          const isFirstSlide = this.currentPage === 1;
          const isLastSlide = this.currentPage === this.totalPages; // Bug Dawn : this.slidesToShow.length;

          if (isFirstSlide && event.currentTarget.name === 'previous') {
            let step = this.slidesToShow.length;
            this.slideScrollPosition = this.slider.scrollLeft + step * this.sliderSlideOffset;
          } else if (isLastSlide && event.currentTarget.name === 'next') {
            this.slideScrollPosition = 0;
          }
        }

        this.setSlidePosition(this.slideScrollPosition);
      }

      onLinkClick(event) {
        event.preventDefault();
        let step = this.navigationLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage;
        this.slideScrollPosition = this.slider.scrollLeft + step * this.sliderSlideOffset;
        this.setSlidePosition(this.slideScrollPosition);
      }

      setDragging() {
        let setDragging = false,
          freeScroll = false;

        if (this.enableDraggingMobile && this.enableDraggingDesktop) setDragging = true;
        if (!setDragging && this.enableDraggingMobile && window.innerWidth < 750) setDragging = true;
        if (!setDragging && this.enableDraggingDesktop && window.innerWidth >= 750) setDragging = true;

        if (this.enableFreeScrollMobile && this.enableFreeScrollDesktop) freeScroll = true;
        if (!freeScroll && this.enableFreeScrollMobile && window.innerWidth < 750) freeScroll = true;
        if (!freeScroll && this.enableFreeScrollDesktop && window.innerWidth >= 750) freeScroll = true;

        if (setDragging) {
          this.isPressed = false;
          this.freeScroll = freeScroll;
          this.slider.addEventListener('mousedown', this.mouseDownHandling.bind(this));
          this.slider.addEventListener('mousemove', this.mouseMoveHandling.bind(this));
          this.slider.addEventListener('mouseup', this.mouseUpHandling.bind(this));
          this.slider.addEventListener('mouseleave', this.mouseLeaveHandling.bind(this));
        }
      }

      mouseDownHandling(event) {
        this.isPressed = true;
        this.slider.classList.add('deployer-slider--dragging');
        this.cursorX = event.pageX - this.slider.offsetLeft;
        this.slideScrollPosition = this.slider.scrollLeft;
      }

      mouseMoveHandling(event) {
        if (!this.isPressed) return;
        event.preventDefault();
        const x = event.pageX - this.slider.offsetLeft;
        const dist = x - this.cursorX;

        if (this.freeScroll) {
          this.slider.scrollLeft = this.slideScrollPosition - dist;
        } else {
          this.newSlideScrollPosition = this.slideScrollPosition - dist;
        }
      }

      mouseUpHandling() {
        this.mouseLeaveHandling();
        if (!this.freeScroll) this.setSlidePosition(this.newSlideScrollPosition);
      }

      mouseLeaveHandling() {
        this.isPressed = false;
        this.slider.classList.remove('deployer-slider--dragging');
      }

      setAutoPlay() {
        this.autoplaySpeed = this.autoplaySpeed.dataset.speed * 1000;
        this.addEventListener('mouseover', this.focusInHandling.bind(this));
        this.addEventListener('mouseleave', this.focusOutHandling.bind(this));
        this.addEventListener('focusin', this.focusInHandling.bind(this));
        this.addEventListener('focusout', this.focusOutHandling.bind(this));

        if (this.autoplayButton) {
          this.autoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
          this.autoplayButtonIsSetToPlay = true;
          this.play();
        } else {
          this.reducedMotion.matches ? this.pause() : this.play();
        }
      }

      focusInHandling(event) {
        if (this.autoplayButton) {
          const focusedOnAutoplayButton = event.target === this.autoplayButton || this.autoplayButton.contains(event.target);
          if (this.autoplayButtonIsSetToPlay && focusedOnAutoplayButton) {
            this.play();
          } else if (this.autoplayButtonIsSetToPlay) {
            this.pause();
          }
        } else if (this.reducedMotion.matches) {
          this.pause();
        }
      }

      focusOutHandling(event) {
        if (this.autoplayButton) {
          const focusedOnAutoplayButton = event.target === this.autoplayButton || this.autoplayButton.contains(event.target);
          if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
          this.play();
        } else if (!this.reducedMotion.matches) {
          this.play();
        }
      }

      autoPlayToggle() {
        this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
        this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
        this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
      }

      togglePlayButtonState(pauseAutoplay) {
        if (pauseAutoplay) {
          this.autoplayButton.classList.add('deployer-slider-button--autoplay-paused');
          this.autoplayButton.setAttribute('aria-label', window.deployerStrings.play);
        } else {
          this.autoplayButton.classList.remove('deployer-slider-button--autoplay-paused');
          this.autoplayButton.setAttribute('aria-label', window.deployerStrings.pause);
        }
      }

      play() {
        this.slider.setAttribute('aria-live', 'off');
        clearInterval(this.autoplay);
        this.autoplay = setInterval(this.autoRotateSlides.bind(this), this.autoplaySpeed);
      }

      pause() {
        this.slider.setAttribute('aria-live', 'polite');
        clearInterval(this.autoplay);
      }

      autoRotateSlides() {
        const isFirstSlide = this.currentPage === 1;
        const isLastSlide = this.currentPage === this.totalPages; // Bug Dawn : this.slidesToShow.length;

        if (this.direction === 'left') {
          this.slideScrollPosition = this.slider.scrollLeft + this.step * this.sliderSlideOffset;
        } else {
          this.slideScrollPosition = this.slider.scrollLeft - this.step * this.sliderSlideOffset;
        }

        if (this.direction == 'left' && isLastSlide) {
          this.enableLoop ? (this.slideScrollPosition = 0) : this.pause();
        }

        if (this.direction == 'right' && isFirstSlide) {
          this.enableLoop ? (this.slideScrollPosition = this.slider.scrollLeft + this.slides.length * this.sliderSlideOffset) : this.pause();
        }

        this.setSlidePosition(this.slideScrollPosition);
      }

      setSlidePosition(position) {
        this.slider.scrollTo({
          left: position,
        });
      }
    }
  );
}
