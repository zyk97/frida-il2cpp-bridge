import { cache } from "decorator-cache-getter";
import { raise } from "../../utils/console";
import { NativeStruct } from "../../utils/native-struct";

/** Represents a `Il2CppThread`. */
class Il2CppThread extends NativeStruct {
    /** Gets the attached threads. */
    static get all(): Il2CppThread[] {
        const array: Il2Cpp.Thread[] = [];

        const sizePointer = Memory.alloc(Process.pointerSize);
        const startPointer = Il2Cpp.Api._threadGetAllAttachedThreads(sizePointer);

        const size = sizePointer.readInt();

        for (let i = 0; i < size; i++) {
            array.push(new Il2Cpp.Thread(startPointer.add(i * Process.pointerSize).readPointer()));
        }

        return array;
    }

    /** Gets the current attached thread, if any. */
    static get current(): Il2Cpp.Thread | null {
        const handle = Il2Cpp.Api._threadCurrent();
        return handle.isNull() ? null : new Il2Cpp.Thread(handle);
    }

    /** @internal */
    @cache
    private static get idOffset(): number {
        const internalThread = this.current?.object.tryField<Il2Cpp.Object>("internal_thread")?.value;
        const object = internalThread ? internalThread : this.current!.object;

        const handle = ptr(object.field<UInt64>("thread_id").value.toString());
        const currentThreadId = Process.getCurrentThreadId();

        for (let i = 0; i < 1024; i++) {
            const candidate = handle.add(i).readS32();
            if (candidate == currentThreadId) {
                return i;
            }
        }

        raise(`couldn't determine the offset for a native thread id value`);
    }

    /** Gets the native id of the current thread. */
    get id(): number {
        const internalThread = this.object.tryField<Il2Cpp.Object>("internal_thread")?.value;
        const object = internalThread ? internalThread : this.object;

        return ptr(object.field<UInt64>("thread_id").value.toString()).add(Il2Cpp.Thread.idOffset).readS32();
    }

    /** Determines whether the current thread is the garbage collector finalizer one. */
    get isFinalizer(): boolean {
        return !Il2Cpp.Api._threadIsVm(this);
    }

    /** Gets the encompassing object of the current thread. */
    @cache
    get object(): Il2Cpp.Object {
        return new Il2Cpp.Object(this);
    }

    /** Detaches the thread from the application domain. */
    detach(): void {
        return Il2Cpp.Api._threadDetach(this);
    }
}

Il2Cpp.Thread = Il2CppThread;

declare global {
    namespace Il2Cpp {
        class Thread extends Il2CppThread {}
    }
}
