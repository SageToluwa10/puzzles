(function(globalScope) {
    "use strict";

    // Glue for referencing JS objects from C as (opaque) void* handles.

    var handle_map = {},
        last_handle = 7000;

    function CHandle(obj) {
        var chandle = obj.chandle;
        if (!chandle) {
            chandle = ++last_handle;
            handle_map[chandle] = obj;
            obj.chandle = chandle;
            obj.free = function() {
                if (handle_map[chandle] === obj) {
                    handle_map[chandle] = "deadbeef";
                } else {
                    throw "calling CHandle.free on already-freed object";
                }
            };
        }
        return chandle;
    }

    var exported_functions = {};

    function export_to_c(method, name, rettype, argtypes) {
        rettype = rettype || 'void';
        argtypes = argtypes || [];
        var _name = '_' + name;
        globalScope[_name] = exported_functions[_name] = function() {
            // Convert arguments from C to JavaScript types:
            var args = Array.prototype.slice.call(arguments);
            for (var i = 0; i < argtypes.length; i++) {
                switch (argtypes[i]) {
                    case 'string':
                        args[i] = Pointer_stringify(args[i]);
                        break;
                    case 'handle':
                        args[i] = handle_map[args[i]];
                        break;
                }
            }
            var retval;
            if (argtypes.length >= 1 && argtypes[0] == 'handle') {
                // If first argtype is handle, call as a method on that object
                var obj = args.shift();
                retval = method.apply(obj, args);
            } else {
                retval = method.apply(args);
            }
            // Convert return from JavaScript to C types
            switch (rettype) {
                case 'string':
                    retval = allocate(intArrayFromString(retval), 'i8', ALLOC_STACK);
                    break;
                case 'handle':
                    retval = CHandle(retval);
                    break;
            }
            return retval;
        }
    }
    Module.export_to_c = export_to_c;

    function reexport_all_to_c(scope) {
        // Necessary to work around an IE8 bug that removes our functions
        // from window when the Emscripten generated code declares var statements
        // for them. Call from Emscripten pre-js.
        scope = scope || globalScope;
        Object.keys(exported_functions).map(function(_name) {
            scope[_name] = exported_functions[_name];
        });
    }
    Module.reexport_all_to_c = reexport_all_to_c;

    function c_to_js_array(ptr, len, type) {
        var ptrtype = type + '*',
            size = Runtime.getNativeTypeSize(type),
            arr = [];
        for (var i = 0; i < len; i++) {
            arr.push(getValue(ptr, ptrtype));
            ptr += size;
        }
        return arr;
    }
    Module.c_to_js_array = c_to_js_array;

    globalScope.CHandle = CHandle;
})(window);

