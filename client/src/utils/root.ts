// export root;

const __window = typeof window !== 'undefined' && window;
const __global = typeof global !== 'undefined' && global;
const root: any = __window || __global;

export default root;