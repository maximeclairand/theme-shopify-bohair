/**
 * SDK pour effectuer des requêtes GraphQL vers l'API Storefront de Shopify
 * Se concentre principalement sur les fonctionnalités de remises (discounts)
 */
class DeployerStorefrontApi {
  /**
   * Initialise le SDK avec une configuration
   * @param {object} config - Configuration de l'API (optionnelle)
   */
  constructor(config = {}) {
    // Configuration par défaut avec fusion des options fournies
    this.config = {
      STOREFRONT_ACCESS_TOKEN: '406ed0c94279f1bc828f4c1dff901b1e', // Token d'accès à l'API Storefront
      SHOP_DOMAIN: '5e2e8d-3b.myshopify.com', // Domaine du shop (ex: votre-boutique.myshopify.com)
      API_VERSION: '2025-01', // Version de l'API Storefront
      TIMEOUT: 10000, // 10 secondes
      ...config,
    };

    // Validation des paramètres obligatoires
    if (!this.config.STOREFRONT_ACCESS_TOKEN) {
      console.warn('DeployerStorefrontApi: STOREFRONT_ACCESS_TOKEN est requis');
    }

    if (!this.config.SHOP_DOMAIN) {
      console.warn('DeployerStorefrontApi: SHOP_DOMAIN est requis');
    }
  }

  /**
   * Construit l'URL de l'API Storefront
   * @returns {string} URL complète de l'API
   */
  getApiUrl() {
    return `https://${this.config.SHOP_DOMAIN}/api/${this.config.API_VERSION}/graphql.json`;
  }

  /**
   * Effectue une requête GraphQL vers l'API Storefront
   * @param {string} query - Requête GraphQL
   * @param {object} variables - Variables pour la requête GraphQL
   * @param {object} options - Options additionnelles
   * @returns {Promise} - Promesse avec la réponse
   */
  async request(query, variables = {}, options = {}) {
    const { timeout = this.config.TIMEOUT, headers = {} } = options;

    // Créer l'AbortController pour le timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Préparer les en-têtes
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.STOREFRONT_ACCESS_TOKEN,
        ...headers,
      };

      // Préparer les options de fetch
      const fetchOptions = {
        method: 'POST',
        headers: requestHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          query,
          variables,
        }),
      };

      // Effectuer la requête
      const response = await fetch(this.getApiUrl(), fetchOptions);

      // Nettoyer le timeout
      clearTimeout(timeoutId);

      // Vérifier si la réponse est OK
      if (!response.ok) {
        // Essayer de récupérer les détails de l'erreur
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          errorDetails = { message: response.statusText };
        }

        throw {
          status: response.status,
          message: errorDetails.message || `Erreur ${response.status}`,
          details: errorDetails,
        };
      }

      // Retourner les données
      const data = await response.json();

      // Vérifier si la réponse contient des erreurs GraphQL
      if (data.errors && data.errors.length > 0) {
        throw {
          status: 200, // GraphQL renvoie 200 même avec des erreurs
          message: data.errors[0].message,
          details: data.errors,
        };
      }

      return data.data;
    } catch (error) {
      // Nettoyer le timeout en cas d'erreur
      clearTimeout(timeoutId);

      // Gérer l'erreur de timeout spécifiquement
      if (error.name === 'AbortError') {
        throw {
          status: 408, // Request Timeout
          message: 'La requête a pris trop de temps. Veuillez réessayer.',
        };
      }

      // Rethrow l'erreur
      throw error;
    }
  }

  /**
   * Récupère l'ID du panier actuel
   * @returns {Promise<string>} - ID du panier
   */
  async getCartId() {
    // Essayer de récupérer l'ID du panier depuis les cookies
    const cartCookie = this.getCookie('cart');

    if (cartCookie) {
      // Décoder l'ID du panier depuis le cookie pour le format Storefront API
      const decodedCartId = this.decodeCartId(cartCookie);

      // Vérifier si le panier existe toujours
      try {
        const cartData = await this.getCart(decodedCartId);
        if (cartData && cartData.cart) {
          return decodedCartId;
        }
      } catch (error) {
        console.warn("Panier existant non trouvé, création d'un nouveau panier");
      }
    }
  }

  /**
   * Récupère la valeur d'un cookie par son nom
   * @param {string} name - Nom du cookie
   * @returns {string|null} - Valeur du cookie ou null si non trouvé
   */
  getCookie(name) {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  }

  /**
   * Décode l'ID du panier du format cookie vers le format Storefront API
   * @param {string} cartId - ID du panier au format cookie
   * @returns {string} - ID du panier au format Storefront API
   */
  decodeCartId(cartId) {
    return `gid://shopify/Cart/${cartId}`;
  }

  /**
   * Crée un nouveau panier
   * @returns {Promise<string>} - ID du nouveau panier
   */
  async createCart() {
    const query = `
              mutation cartCreate {
                  cartCreate {
                      cart {
                          id
                      }
                      userErrors {
                          field
                          message
                      }
                  }
              }
          `;

    const result = await this.request(query);

    if (result.cartCreate.userErrors.length > 0) {
      throw {
        message: 'Erreur lors de la création du panier',
        details: result.cartCreate.userErrors,
      };
    }

    const cartId = result.cartCreate.cart.id;

    return cartId;
  }

  /**
   * Récupère les informations d'un panier
   * @param {string} cartId - ID du panier
   * @returns {Promise<object>} - Données du panier
   */
  async getCart(cartId) {
    const query = `
              query getCart($cartId: ID!) {
                  cart(id: $cartId) {
                      id
                      lines(first: 100) {
                          edges {
                              node {
                                  id
                                  quantity
                                  merchandise {
                                      ... on ProductVariant {
                                          id
                                          title
                                          product {
                                              id
                                              title
                                          }
                                      }
                                  }
                              }
                          }
                      }
                      discountCodes {
                          code
                          applicable
                      }
                      cost {
                          totalAmount {
                              amount
                              currencyCode
                          }
                          subtotalAmount {
                              amount
                              currencyCode
                          }
                          totalTaxAmount {
                              amount
                              currencyCode
                          }
                      }
                  }
              }
          `;

    return this.request(query, { cartId });
  }

  /**
   * Applique un code de réduction au panier
   * @param {string} discountCode - Code de réduction à appliquer
   * @returns {Promise<object>} - Résultat de l'opération
   */
  async applyDiscountCode(discountCode) {
    const cartId = await this.getCartId();

    const query = `
              mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
                  cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
                      cart {
                          id
                          discountCodes {
                              code
                              applicable
                          }
                          cost {
                              totalAmount {
                                  amount
                                  currencyCode
                              }
                              subtotalAmount {
                                  amount
                                  currencyCode
                              }
                          }
                      }
                      userErrors {
                          field
                          message
                      }
                  }
              }
          `;

    return this.request(query, {
      cartId,
      discountCodes: [discountCode],
    });
  }

  /**
   * Supprime tous les codes de réduction du panier
   * @returns {Promise<object>} - Résultat de l'opération
   */
  async removeDiscountCodes() {
    const cartId = await this.getCartId();

    const query = `
              mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
                  cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
                      cart {
                          id
                          discountCodes {
                              code
                              applicable
                          }
                          cost {
                              totalAmount {
                                  amount
                                  currencyCode
                              }
                              subtotalAmount {
                                  amount
                                  currencyCode
                              }
                          }
                      }
                      userErrors {
                          field
                          message
                      }
                  }
              }
          `;

    return this.request(query, {
      cartId,
      discountCodes: [], // Tableau vide pour supprimer tous les codes
    });
  }

  /**
   * Met à jour la configuration globale du SDK
   * @param {object} config - Nouvelle configuration
   */
  updateConfig(config = {}) {
    Object.assign(this.config, config);
  }

  /**
   * Récupère la configuration actuelle
   * @returns {object} - Configuration actuelle
   */
  getConfig() {
    return { ...this.config };
  }
}

// Exporter une instance singleton du SDK
const deployerStorefrontApiInstance = new DeployerStorefrontApi();

// Exporter le SDK pour une utilisation globale
window.DeployerStorefrontApi = deployerStorefrontApiInstance;
