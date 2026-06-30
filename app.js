// VERRA by Mugai - Interactive Experience Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('VERRA website active. Rooted Skin Science narrative loaded.');

  // Intersection Observer for organic scroll reveals
  const revealOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target); // Reveal once
      }
    });
  }, revealOptions);

  const revealElements = document.querySelectorAll('.scroll-reveal');
  revealElements.forEach(el => {
    revealObserver.observe(el);
  });

  // Soft micro-tilt interaction for the editorial cards
  const cards = document.querySelectorAll('.section-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within element
      const y = e.clientY - rect.top;  // y position within element
      
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      // Calculate rotation angles (max 1.5 degrees for subtle feel)
      const rotateY = ((x - xc) / xc) * 1.5;
      const rotateX = ((yc - y) / yc) * 1.5;
      
      card.style.transform = `perspective(1000px) translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear status
      formStatus.className = 'form-status';
      formStatus.style.display = 'none';
      formStatus.innerText = '';
      
      // Get values
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const message = document.getElementById('contact-message').value.trim();
      
      // Basic client-side validation
      if (!name || !email || !message) {
        showStatus('Please fill in all required fields.', 'error');
        return;
      }
      
      // Disable submit
      submitBtn.disabled = true;
      submitBtn.innerText = 'Sending...';
      
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, email, phone, message })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          showStatus(data.message || 'Thank you! Your message has been sent successfully.', 'success');
          contactForm.reset();
        } else {
          showStatus(data.error || 'Failed to send message. Please try again.', 'error');
        }
      } catch (err) {
        console.error('Error submitting form:', err);
        showStatus('A network error occurred. Please check your connection and try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Send Message';
      }
    });
  }

  function showStatus(text, type) {
    formStatus.innerText = text;
    formStatus.className = `form-status ${type}`;
    formStatus.style.display = 'block';
  }

  // Record Page Visit (Analytics)
  const recordVisit = async () => {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page: window.location.pathname,
          referer: document.referrer || 'Direct',
          ua: navigator.userAgent
        })
      });
    } catch (err) {
      console.warn('Failed to record page visit:', err);
    }
  };

  // Trigger page visit logging for the homepage
  const pathname = window.location.pathname;
  if (pathname === '/' || pathname === '/index.html') {
    setTimeout(recordVisit, 850);
  }
});
