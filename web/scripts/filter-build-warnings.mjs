const originalWarn = console.warn.bind(console);

console.warn = (...args) => {
    const message = args.map(String).join(' ');
    if (message.includes('[baseline-browser-mapping] The data in this module is over two months old')) {
        return;
    }
    originalWarn(...args);
};
