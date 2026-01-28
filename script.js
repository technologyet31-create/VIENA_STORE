document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-btn');
    const body = document.body;
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    // Toggle sidebar
    toggleBtn.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
    });

    // Handle navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get target page
            const pageId = link.dataset.page;
            const targetPage = document.getElementById(pageId);

            if (targetPage) {
                // Update active link
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Update active page
                pages.forEach(p => p.classList.remove('active'));
                targetPage.classList.add('active');
            }
        });
    });

    // Set the first page as active by default
    if (pages.length > 0) {
        pages[0].classList.add('active');
    }
    if (navLinks.length > 0) {
        navLinks[0].classList.add('active');
    }
});
