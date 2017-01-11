export function promisify<T>(f: (cb: (err: any, res: T) => void) => void): () => Promise<T>;
export function promisify<A,T>(f: (arg: A, cb: (err: any, res: T) => void) => void): (arg: A) => Promise<T>;
export function promisify<A,A2,T>(f: (arg: A, arg2: A2, cb: (err: any, res: T) => void) => void): (arg: A, arg2: A2) => Promise<T>;
export function promisify<A,A2,A3,T>(f: (arg: A, arg2: A2, arg3: A3, cb: (err: any, res: T) => void) => void): (arg: A, arg2: A2, arg3: A3) => Promise<T>;
export function promisify<A,A2,A3,A4,T>(f: (arg: A, arg2: A2, arg3: A3, arg4: A4, cb: (err: any, res: T) => void) => void): (arg: A, arg2: A2, arg3: A3, arg4: A4) => Promise<T>;

export function promisify(f:Function) {
    return function(this:any, ...args:Array<any>) {
        return new Promise((resolve, reject) => {
            args.push((err:any, result:any) => err !== undefined && err !== null ? reject(err) : resolve(result));
            f.apply(this, args);
        });
    }
}
