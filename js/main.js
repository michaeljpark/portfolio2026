// Navigation Indicator Animation
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    const indicator = document.querySelector('.nav-indicator');
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    const nav = document.querySelector('nav');

    // Scroll-based navigation visibility
    let lastScrollY = window.scrollY;
    let ticking = false;

    // Show nav initially at top of page
    if (window.scrollY < 100) {
        nav.classList.add('nav-visible');
    }

    function updateNavVisibility() {
        const currentScrollY = window.scrollY;

        // Always show nav at top of page
        if (currentScrollY < 100) {
            nav.classList.add('nav-visible');
        }
        // Show nav when scrolling up
        else if (currentScrollY < lastScrollY) {
            nav.classList.add('nav-visible');
        }
        // Hide nav when scrolling down
        else if (currentScrollY > lastScrollY) {
            nav.classList.remove('nav-visible');
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    function requestNavUpdate() {
        if (!ticking) {
            window.requestAnimationFrame(updateNavVisibility);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestNavUpdate, { passive: true });

    // Get current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Set active page indicator
    function setActiveIndicator(link, instant = false) {
        if (!indicator || !link) return;

        const linkRect = link.getBoundingClientRect();
        const navLinksContainer = link.parentElement;
        const containerRect = navLinksContainer.getBoundingClientRect();

        // Add padding to make pill background larger than text
        const paddingExtra = 16; // 1rem in pixels
        const left = linkRect.left - containerRect.left - paddingExtra;
        const width = linkRect.width + (paddingExtra * 2);

        if (instant) {
            indicator.style.transition = 'none';
        } else {
            indicator.style.transition = 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
        }

        indicator.style.left = left + 'px';
        indicator.style.width = width + 'px';
        indicator.classList.add('active');

        // Force reflow to apply transition
        if (instant) {
            void indicator.offsetWidth;
            indicator.style.transition = 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
        }
    }

    // Find and set active link on page load
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
            const linkPage = href.split('/').pop();
            if (linkPage === currentPage ||
                (currentPage === 'index.html' && linkPage === 'index.html') ||
                (currentPage === '' && linkPage === 'index.html')) {
                setActiveIndicator(link, true);
                link.classList.add('active');
            }
        }
    });

    // Hover effect for navigation links
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            setActiveIndicator(this, false);
        });
    });

    // Return indicator to active page on mouse leave
    const navLinksContainer = document.querySelector('.nav-links');
    if (navLinksContainer) {
        navLinksContainer.addEventListener('mouseleave', function() {
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink) {
                setActiveIndicator(activeLink, false);
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    // Mobile Menu Toggle
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : 'auto';
        });

        // Close mobile menu when clicking on a link
        const mobileMenuLinks = mobileMenu.querySelectorAll('a');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add fade-in animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    // Observe all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        observer.observe(section);
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink && indicator) {
                setActiveIndicator(activeLink, true);
            }
        }, 250);
    });



    // Sort portfolio items by date (newest first)
    function sortPortfolioItems() {
        const grid = document.querySelector('.portfolio-grid');
        if (!grid) return;

        const items = Array.from(grid.querySelectorAll('.portfolio-card-wrapper'));
        
        items.sort((a, b) => {
            const dateA = new Date(a.getAttribute('data-date') || '2000-01-01');
            const dateB = new Date(b.getAttribute('data-date') || '2000-01-01');
            return dateB - dateA; // Descending order
        });

        // Re-append items in sorted order
        items.forEach(item => grid.appendChild(item));
    }

    // Run sorting
    sortPortfolioItems();

    // Mobile Portfolio Interaction
    const portfolioWrappers = document.querySelectorAll('.portfolio-card-wrapper');
    
    portfolioWrappers.forEach(wrapper => {
        wrapper.addEventListener('click', function(e) {
            // Only apply on mobile width
            if (window.innerWidth <= 768) {
                // If the wrapper is not active yet
                if (!this.classList.contains('mobile-active')) {
                    e.preventDefault(); // Prevent link navigation
                    
                    // Remove active class from all other wrappers
                    portfolioWrappers.forEach(w => {
                        if (w !== this) w.classList.remove('mobile-active');
                    });
                    
                    // Activate this wrapper
                    this.classList.add('mobile-active');
                }
                // If already active, let the click proceed (to link)
            }
        });
    });

    // Scroll-based Logo Opacity
    function handleLogoScroll() {
        const logoContainer = document.querySelector('.hero-logo-container');
        if (!logoContainer) return;

        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const maxScroll = docHeight - windowHeight;
        
        // Calculate the start of the transition
        // We want the transition to happen during the blank section scroll
        // Blank section is 120vh.
        // We start the transition when the user enters the blank section zone.
        const transitionDistance = windowHeight * 1.2; // 120vh
        const startTransition = Math.max(0, maxScroll - transitionDistance);
        
        let progress = 0;
        if (maxScroll > 0 && scrollY > startTransition) {
            progress = (scrollY - startTransition) / transitionDistance;
        }
        
        progress = Math.min(Math.max(progress, 0), 1);

        // Opacity: 0.03 -> 1.0
        const startOpacity = 0.03;
        const endOpacity = 1.0;
        const currentOpacity = startOpacity + (endOpacity - startOpacity) * progress;
        
        logoContainer.style.opacity = currentOpacity;
    }

    window.addEventListener('scroll', () => {
        window.requestAnimationFrame(handleLogoScroll);
    });
    
    window.addEventListener('resize', handleLogoScroll);
    
    // Initial call
    handleLogoScroll();
});

/* View More Functionality */
document.addEventListener('DOMContentLoaded', function() {
    const recentWorkGrid = document.querySelector('.recent-work .portfolio-grid');
    if (!recentWorkGrid) return;

    const items = recentWorkGrid.querySelectorAll('.portfolio-card-wrapper');
    const viewMoreBtn = document.getElementById('viewMoreBtn');
    const itemsToShow = 8;

    // Initially hide items beyond the limit
    if (items.length > itemsToShow) {
        for (let i = itemsToShow; i < items.length; i++) {
            items[i].style.display = 'none';
        }
    } else if (viewMoreBtn) {
        viewMoreBtn.parentElement.style.display = 'none';
    }

    if (viewMoreBtn) {
        viewMoreBtn.addEventListener('click', function() {
            for (let i = itemsToShow; i < items.length; i++) {
                items[i].style.display = '';
                items[i].style.animation = 'fadeInUp 0.8s ease-out forwards';
            }
            this.parentElement.style.display = 'none';
        });
    }

    // Sorting Navigation Logic
    const sortLinks = document.querySelectorAll('.sort-nav-link');
    const sortIndicator = document.querySelector('.sort-nav-indicator');
    
    function updateSortIndicator(link) {
        if (!sortIndicator || !link) return;
        
        const left = link.offsetLeft;
        const width = link.offsetWidth;
        
        sortIndicator.style.left = `${left}px`;
        sortIndicator.style.width = `${width}px`;
    }
    
    if (sortLinks.length > 0 && sortIndicator) {
        
        const recentWorkSection = document.querySelector('.recent-work');
        const clientProjectsSection = document.querySelector('.client-projects');
        const thesisWorkSection = document.querySelector('.thesis-work');
        const collaborativeWorkSection = document.querySelector('.collaborative-work-section');

        sortLinks.forEach(link => {
            link.addEventListener('click', function() {
                sortLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                updateSortIndicator(this);

                const filter = this.getAttribute('data-filter');
                
                // Filtering Logic
                if (filter === 'case-study') {
                    // Show Recent Work & Client Projects
                    if (recentWorkSection) recentWorkSection.style.display = 'block';
                    if (clientProjectsSection) clientProjectsSection.style.display = 'block';
                    if (thesisWorkSection) thesisWorkSection.style.display = 'none';
                    if (collaborativeWorkSection) collaborativeWorkSection.style.display = 'none';
                } else if (filter === 'collaborative-work') {
                    // Show Collaborative Work section
                    if (recentWorkSection) recentWorkSection.style.display = 'none';
                    if (clientProjectsSection) clientProjectsSection.style.display = 'none';
                    if (thesisWorkSection) thesisWorkSection.style.display = 'none';
                    if (collaborativeWorkSection) collaborativeWorkSection.style.display = 'block';
                } else if (filter === 'thesis') {
                    // Show Thesis Only
                    if (recentWorkSection) recentWorkSection.style.display = 'none';
                    if (clientProjectsSection) clientProjectsSection.style.display = 'none';
                    if (thesisWorkSection) thesisWorkSection.style.display = 'block';
                    if (collaborativeWorkSection) collaborativeWorkSection.style.display = 'none';
                }
            });
        });

        // Initialize first link as active
        const activeLink = document.querySelector('.sort-nav-link.active') || sortLinks[0];
        activeLink.classList.add('active');
        
        setTimeout(() => {
            updateSortIndicator(activeLink);
        }, 100);
        
        window.addEventListener('resize', () => {
            const currentActive = document.querySelector('.sort-nav-link.active');
            if (currentActive) {
                updateSortIndicator(currentActive);
            }
        });
    }

});

/* Report Modal Functionality */
document.addEventListener('DOMContentLoaded', function() {
    const reportBtns = document.querySelectorAll('.view-report-pill-btn, .view-report-mobile-link');
    const modal = document.getElementById('report-modal');
    const closeBtn = document.querySelector('.report-close');

    if (reportBtns.length > 0 && modal) {
        const modalImg = modal.querySelector('.report-modal-content img');

        reportBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const imgSrc = this.getAttribute('data-report-src');
                if (imgSrc && modalImg) {
                    modalImg.src = imgSrc;
                }

                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            });
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }

        window.addEventListener('click', function(e) {
            if (e.target == modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
});
