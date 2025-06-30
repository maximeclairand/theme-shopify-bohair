if (!customElements.get('deployer-stories')) {
  customElements.define(
    'deployer-stories',
    class DeployerStories extends HTMLElement {
      constructor() {
        super();
        this.storiesOverlay = document.querySelector('.deployer-stories__overlay');
        this.bubbles = this.querySelectorAll('.story-bubble');
        this.mobileBubbles = document.querySelectorAll('.deployer-stories-mobile .story-bubble');
        this.storiesSlides = this.querySelectorAll('.story-slide');
        this.header = document.querySelector('.section-header.shopify-section-group-header-group');
        this.storiesSlider = this.querySelector('.stories-slider');
        this.storyContainers = this.querySelectorAll('.story-slider');
        this.storiesContainer = this.querySelector('.stories-slider-container');
        this.nextSlide = this.querySelector('.swiper-button-next.stories-slider-arrow');
        this.prevSlide = this.querySelector('.swiper-button-prev.stories-slider-arrow');
        this.storiesContainerClose = this.querySelector('.stories-slider-container__close');
        this.addStoriesOverlayInBody();
        this.initMainSwiper();
        this.storyContainers.forEach((story) => {
          this.initSwiper(story);
        });
      }

      connectedCallback() {
        // Ouverture du storiesContainer et slide jusqu'a la story correspondante
        this.bubbles.forEach((bubble, index) => {
          bubble.addEventListener('click', (e) => {
            this.openStoriesContainer(e, index);
          });
        });
        this.mobileBubbles.forEach((bubble, index) => {
          bubble.addEventListener('click', (e) => {
            this.openStoriesContainer(e, index);
          });
        });
        // Fermeture du storiesContainer
        this.storiesContainerClose.addEventListener('click', () => {
          this.closeStoriesContainer();
        });
        // Fermeture du storiesContainer avec la touche echap
        document.addEventListener('keydown', (e) => {
          if (this.storiesContainer.classList.contains('stories-slider-container--active') && e.key == 'Escape') {
            this.closeStoriesContainer();
          }
        });
        let startY;

        this.storiesContainer.addEventListener(
          'touchstart',
          (e) => {
            startY = e.touches[0].clientY;
          },
          false
        );

        this.storiesContainer.addEventListener(
          'touchend',
          (e) => {
            let endY = e.changedTouches[0].clientY;
            if (endY - startY > 50) {
              // Vous pouvez ajuster ce nombre selon vos préférences
              this.closeStoriesContainer();
            }
          },
          false
        );

        const muteButtons = document.querySelectorAll('.mute-toggle');
        muteButtons.forEach((button) => {
          button.addEventListener('click', function () {
            const video = button.closest('.story-slide-video').querySelector('video');
            if (video.muted) {
              video.muted = false;
              video.removeAttribute('muted');
              video.volume = 1;
              button.querySelector('#mute-toggle-on').classList.remove('mute-toggle-icon--hidden');
              button.querySelector('#mute-toggle-off').classList.add('mute-toggle-icon--hidden');
            } else {
              video.muted = true;
              video.setAttribute('muted', 'muted');
              video.volume = 0;
              button.querySelector('#mute-toggle-on').classList.add('mute-toggle-icon--hidden');
              button.querySelector('#mute-toggle-off').classList.remove('mute-toggle-icon--hidden');
            }
          });
        });
      }

      addStoriesOverlayInBody() {
        if (!this.storiesOverlay) {
          const storiesOverlay = document.createElement('deployer-stories-overlay');
          storiesOverlay.classList.add('deployer-stories__overlay');
          document.body.insertAdjacentElement('beforeend', storiesOverlay);
          this.storiesOverlay = storiesOverlay;
        }
      }

      openStoriesContainer(e, index) {
        document.body.style.overflow = 'hidden';
        this.header.style.top = '-200px';
        const storyBubble = e.target.closest('.story-bubble');
        this.toggleBubbleClasses(storyBubble);

        let _this = this;
        if (this.storiesOverlay) {
          this.storiesOverlay.innerHTML = this.outerHTML;
          _this = this.storiesOverlay.querySelector('deployer-stories');
        }

        _this.storiesContainer.classList.add('stories-slider-container--active');
        _this.storiesSlider.swiper.slideTo(index);
        const mainSliderActiveSlide = _this.storiesSlider.swiper.slides[index];
        mainSliderActiveSlide.resetStory();
        mainSliderActiveSlide.querySelector('.story-slider').swiper.slideTo(0);
        _this.playStory(mainSliderActiveSlide);

        if (index !== 0) return;
      }

      toggleBubbleClasses(bubble) {
        bubble.classList.add('story-bubble--seen');
        bubble.classList.add('story-bubble--clicked');
      }

      playStory(mainActiveSlide) {
        const activeSlide = mainActiveSlide.querySelector('.story-slider').swiper.slides[0];
        mainActiveSlide.playMedia(activeSlide);
      }

      closeStoriesContainer() {
        this.storiesContainer.classList.remove('stories-slider-container--active');
        document.body.style.overflow = 'auto';
        this.header.style.top = '0';
        this.storiesSlides.forEach((slide) => {
          slide.resetStory();
        });
      }

      initMainSwiper() {
        const deployerStories = this;
        const swiper = new Swiper(this.storiesSlider, {
          direction: 'horizontal',
          allowTouchMove: false,

          navigation: {
            nextEl: this.nextSlide,
            prevEl: this.prevSlide,
          },
        });
        // Quand on change de slide, on lance la lecture de la story
        swiper.on('slideChange', function () {
          const previousActiveSlide = swiper.slides[swiper.previousIndex];
          previousActiveSlide.resetStory();
          const mainActiveSlide = swiper.slides[swiper.activeIndex];
          mainActiveSlide.querySelector('.story-slider').swiper.slideTo(0);
          deployerStories.playStory(mainActiveSlide);
        });
      }

      initSwiper(slider) {
        const deployerStory = slider.closest('deployer-story');
        const swiper = new Swiper(slider, {
          // Optional parameters
          direction: 'horizontal',
          allowTouchMove: false,
          autoplay: false,
          slidesPerView: 1,

          // Navigation arrows
          navigation: {
            nextEl: deployerStory.querySelector('.swiper-button-next'),
            prevEl: deployerStory.querySelector('.swiper-button-prev'),
          },
        });
        swiper.on('slideChange', function () {
          deployerStory.cancelTimeout();

          if (swiper.activeIndex > swiper.previousIndex) {
            deployerStory.fillProgressBar(swiper.slides[swiper.previousIndex]); // Si on swipe vers la droite
          } else {
            deployerStory.resetProgressBar(swiper.slides[swiper.previousIndex]); // si on swipe vers la gauche
          }
          deployerStory.playMedia(swiper.slides[swiper.activeIndex]);
        });
      }
    }
  );
}

if (!customElements.get('deployer-story')) {
  customElements.define(
    'deployer-story',
    class DeployerStory extends HTMLElement {
      constructor() {
        super();
        this.progressBars = this.querySelectorAll('.story-progress-bar');
        this.deployerStories = this.closest('deployer-stories');
        this.mainSlider = this.deployerStories.querySelector('.stories-slider');
        this.slider = this.querySelector('.story-slider');
        this.timeoutId = null;
        this.intervalId = null;
      }

      resetStory() {
        this.progressBars.forEach((progressBar, index) => {
          const progressBarFill = progressBar.querySelector('.stories-progress-fill');
          progressBarFill.style.width = '0%';
        });

        this.slider.querySelectorAll('video').forEach((video) => {
          video.currentTime = 0;
          video.pause();
        });

        if (this.intervalId) clearInterval(this.intervalId);
        if (this.timeoutId) clearTimeout(this.timeoutId);
      }

      playMedia(activeSlide) {
        const video = activeSlide.querySelector('video');
        const duration = activeSlide.dataset.duration;
        this.updateProgressBar(activeSlide, duration);
        if (video) {
          video.currentTime = 0;
          video.play().catch((error) => {
            console.error('Erreur lors de la lecture de la vidéo:', error);
          });
        }
        this.changeSlide(activeSlide, duration);
        if (this.isLastSlide(activeSlide)) {
          this.markStoryAsSeen();
        }
      }

      markStoryAsSeen() {
        const storyIndex = this.getAttribute('data-index');
        const allBubbles = [
          ...document.querySelectorAll('.deployer-stories .story-bubble'),
          ...document.querySelectorAll('.deployer-stories-mobile .story-bubble'),
        ];
        const correspondingBubbles = allBubbles.filter((bubble) => bubble.getAttribute('data-index') === storyIndex);
        correspondingBubbles.forEach((bubble) => {
          bubble.classList.add('story-bubble--seen');
        });
      }

      updateProgressBar(activeSlide, duration) {
        // Annuler l'intervalle précédent
        if (this.intervalId) clearInterval(this.intervalId);

        const progressBar = this.progressBars[activeSlide.dataset.index];
        const progressBarFill = progressBar.querySelector('.stories-progress-fill');
        progressBarFill.style.width = '0%';
        let width = 0;
        this.intervalId = setInterval(() => {
          width++;
          progressBarFill.style.width = `${width}%`;
          if (width >= 100) {
            clearInterval(this.intervalId);
          }
        }, duration / 100);
      }

      fillProgressBar(slide) {
        const video = slide.querySelector('video');
        if (video) video.pause();

        const progressBar = this.progressBars[slide.dataset.index];
        const progressBarFill = progressBar.querySelector('.stories-progress-fill');
        progressBarFill.style.width = '100%';
      }

      resetProgressBar(slide) {
        const video = slide.querySelector('video');
        if (video) {
          video.pause();
          video.currentTime = 0; // Réinitialiser la position du média pour la prochaine lecture
        }

        const progressBar = this.progressBars[slide.dataset.index];
        const progressBarFill = progressBar.querySelector('.stories-progress-fill');
        progressBarFill.style.width = '0%';
      }

      changeSlide(activeSlide, duration) {
        if (this.timeoutId) clearTimeout(this.timeoutId);

        this.timeoutId = setTimeout(() => {
          if (this.isLastSlide(activeSlide)) {
            if (!this.isLastStory()) {
              this.mainSlider.swiper.slideNext();
            } else {
              this.deployerStories.closeStoriesContainer();
            }
            return;
          }
          this.slider.swiper.slideNext();
        }, duration);
      }

      isLastSlide(activeSlide) {
        return activeSlide.dataset.index == this.slider.querySelectorAll('.swiper-slide').length - 1;
      }

      isLastStory() {
        return this.mainSlider.swiper.activeIndex == this.mainSlider.swiper.slides.length - 1;
      }

      cancelTimeout() {
        if (this.timeoutId !== null) {
          clearTimeout(this.timeoutId);
        }
      }
    }
  );
}
