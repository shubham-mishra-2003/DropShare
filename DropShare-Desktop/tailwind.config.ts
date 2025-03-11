/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}", // ✅ Add all frontend files
        "./renderer/**/*.{js,ts,jsx,tsx}", // ✅ Include renderer directory (if using Vite)
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
