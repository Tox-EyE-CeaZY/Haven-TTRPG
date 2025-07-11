document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const currentTheme = localStorage.getItem('theme') || 'light'; // Default to light

    function applyTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('theme', theme);
        themeToggleButton.textContent = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }

    applyTheme(currentTheme); // Apply saved theme on load

    themeToggleButton.addEventListener('click', () => {
        let newTheme = localStorage.getItem('theme') === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
});