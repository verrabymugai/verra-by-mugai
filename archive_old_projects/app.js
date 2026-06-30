// VERRA by Mugai - Interactive Core Client Script

document.addEventListener('DOMContentLoaded', () => {
  console.log('VERRA by Mugai platform active. Natural Skin Science loaded.');

  // Smooth appearance transitions
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Track add-to-cart clicks for basic local session mock
  const cartButtons = document.querySelectorAll('.add-cart-btn');
  let cartCount = 0;

  cartButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      const name = card.querySelector('.product-name').textContent;
      const price = card.querySelector('.product-price').textContent;
      
      cartCount++;
      console.log(`Mock Add: ${name} (${price}) added to cart. Total items: ${cartCount}`);
      
      // Visual Feedback
      const originalText = button.textContent;
      button.textContent = 'Added ✔';
      button.style.backgroundColor = 'var(--muted-gold)';
      button.style.borderColor = 'var(--muted-gold)';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
        button.style.borderColor = '';
      }, 1500);
    });
  });
});
