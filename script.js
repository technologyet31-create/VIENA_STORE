document.addEventListener('DOMContentLoaded', () => {
    const __vienna_init = async () => {
    // --- Sidebar and Navigation Logic ---
    const toggleBtn = document.getElementById('toggle-btn');
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const MOBILE_BP = 1023;
    const navLinks = document.querySelectorAll('.nav-link, .sidebar-link');
    const pages = document.querySelectorAll('.page');

    const setActivePage = (pageId) => {
        const targetPage = document.getElementById(pageId);
        if (!targetPage) return;

        // update nav link active state
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.page === pageId));

        const current = document.querySelector('.page.active');
        if (current === targetPage) {
            // already active
            document.dispatchEvent(new CustomEvent('page-activated', { detail: { pageId } }));
            return;
        }

        // Prepare target for entering
        targetPage.style.display = 'block';
        targetPage.classList.add('page-enter');

        // Animate current page out
        if (current) {
            current.classList.add('page-exit');
            const onCurrentEnd = () => {
                current.removeEventListener('animationend', onCurrentEnd);
                current.classList.remove('page-exit', 'active');
                current.style.display = 'none';
            };
            current.addEventListener('animationend', onCurrentEnd);
        }

        // When target finish entering, finalize active state
        const onTargetEnd = () => {
            targetPage.removeEventListener('animationend', onTargetEnd);
            targetPage.classList.remove('page-enter');
            // remove active from others, set this active
            pages.forEach(p => p.classList.remove('active'));
            targetPage.classList.add('active');
            document.dispatchEvent(new CustomEvent('page-activated', { detail: { pageId } }));
        };
        targetPage.addEventListener('animationend', onTargetEnd);
    };

    // create overlay element for small screens
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    // Floating open button for mobile (since the sidebar is off-canvas)
    let mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (!mobileMenuBtn) {
        mobileMenuBtn = document.createElement('button');
        mobileMenuBtn.id = 'mobile-menu-btn';
        mobileMenuBtn.className = 'mobile-menu-btn';
        mobileMenuBtn.type = 'button';
        mobileMenuBtn.setAttribute('aria-label', 'فتح القائمة');
        mobileMenuBtn.innerHTML = '☰';
        document.body.appendChild(mobileMenuBtn);
    }

    const closeBtn = document.querySelector('.sidebar-close');
    const setExpanded = (expanded) => {
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(expanded));
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', String(expanded));
    };
    const closeSidebarOverlay = () => {
        body.classList.remove('sidebar-open');
        overlay.style.display = 'none';
        setExpanded(false);
    };
    if (closeBtn) closeBtn.addEventListener('click', closeSidebarOverlay);

    const toggleSidebar = () => {
        // small screens: open as overlay
        if (window.innerWidth <= MOBILE_BP) {
            const opened = body.classList.toggle('sidebar-open');
            if (!opened) overlay.style.display = 'none';
            else overlay.style.display = '';
            setExpanded(opened);
            return;
        }

        // desktop: collapse/expand
        const collapsed = body.classList.toggle('sidebar-collapsed');
        setExpanded(!collapsed);
    };

    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);

    // double-click sidebar header to toggle
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) sidebarHeader.addEventListener('dblclick', () => toggleSidebar());

    // keyboard shortcut to toggle sidebar (Ctrl+B)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && body.classList.contains('sidebar-open')) {
            closeSidebarOverlay();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            toggleSidebar();
        }
    });

    // respect saved state and window width on load
    const applySavedSidebarState = () => {
        try {
            if (window.innerWidth > MOBILE_BP) {
                body.classList.remove('sidebar-collapsed');
                body.classList.remove('sidebar-open');
                overlay && (overlay.style.display = 'none');
            } else {
                // on small screens ensure overlay is hidden until user opens sidebar
                body.classList.remove('sidebar-collapsed');
                body.classList.remove('sidebar-open');
                overlay && (overlay.style.display = 'none');
            }
            // aria-expanded means: overlay open on mobile, not-collapsed on desktop
            if (window.innerWidth <= MOBILE_BP) setExpanded(body.classList.contains('sidebar-open'));
            else setExpanded(!body.classList.contains('sidebar-collapsed'));
        } catch (err) { }
    };
    applySavedSidebarState();
    window.addEventListener('resize', applySavedSidebarState);

    // Highlight active sidebar link by matching pathname
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        try {
            const linkUrl = new URL(link.href, location.href);
            if (linkUrl.pathname === location.pathname || link.classList.contains('active')) {
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        } catch (e) {}
    });

    // navLinks: only intercept if link has data-page (SPA in-page navigation). Otherwise allow normal navigation.
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const page = link.dataset.page;
            if (page) {
                e.preventDefault();
                setActivePage(page);
            } else {
                // if small-screen overlay open, close when navigating
                if (body.classList.contains('sidebar-open')) {
                    closeSidebarOverlay();
                }
            }
        });
    });

    // clicking overlay closes sidebar on small screens
    overlay.addEventListener('click', () => {
        closeSidebarOverlay();
    });

    // Multi-page navigation transitions (keep content, just animate on leave)
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link) return;
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.target === '_blank' || link.hasAttribute('download')) return;
        if (link.dataset && link.dataset.page) return; // SPA-internal
        if (prefersReducedMotion) return;

        let url;
        try { url = new URL(link.href, location.href); } catch { return; }
        if (url.origin !== location.origin) return;
        // allow same-page hash jumps
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

        e.preventDefault();
        if (body.classList.contains('sidebar-open')) closeSidebarOverlay();
        body.classList.add('page-leave');
        setTimeout(() => { location.href = link.href; }, 180);
    }, true);
    };

    if (window.Vienna && window.Vienna.ready && window.Vienna.ready.then) {
        window.Vienna.ready.then(__vienna_init).catch(err => { console.error('Vienna init error', err); __vienna_init(); });
    } else {
        __vienna_init();
    }
});
