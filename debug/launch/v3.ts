import { ITestingSettings } from "../../test/settings.js";
import { ConsoleListener, Logger, LogLevel } from "@pnp/logging";
import { Queryable2, InjectHeaders, Caching, HttpRequestError, createBatch } from "@pnp/queryable";
import { NodeSend, MSAL2, MSAL } from "@pnp/nodejs";
import { combine, isFunc, getHashCode, PnPClientStorage, dateAdd } from "@pnp/common";
import { SSL_OP_NO_TLSv1_1 } from "node:constants";

declare var process: { exit(code?: number): void };

export async function Example(settings: ITestingSettings) {


    const t = new Queryable2({
        url: combine(settings.testing.sp.url, "_api/web"),
    });

    const t2 = new Queryable2({
        url: combine(settings.testing.sp.url, "_api/web/lists"),
    });


    const hackAuth = MSAL(settings.testing.sp.msal.init, settings.testing.sp.msal.scopes);
    const [, init,] = await Reflect.apply(hackAuth, t, ["", { headers: {} }, undefined]);


    const [register, execute] = createBatch(settings.testing.sp.url, NodeSend(), init.headers["Authorization"]);

    t.using(register);
    t2.using(register);

    // most basic implementation
    t.on.log((message: string, level: LogLevel) => {
        console.log(`[${level}] ${message}`);
    });

    // super easy debug
    t.on.error(console.error);
    t2.on.error(console.error);

    // MSAL config via using?
    // t.using(MSAL2(settings.testing.sp.msal.init, settings.testing.sp.msal.scopes));

    // or directly into the event?
    // t.on.pre(MSAL(settings.testing.sp.msal.init, settings.testing.sp.msal.scopes));

    // how to register your own pre-handler
    // t.on.pre(async function (url: string, init: RequestInit) {

    //     // example of setting up default values
    //     url = combine(url, "_api/web");

    //     init.headers["Accept"] = "application/json";
    //     init.headers["Content-Type"] = "application/json;odata=verbose;charset=utf-8";

    //     this.log(`Url: ${url}`);

    //     return [url, init];
    // });

    t.using(InjectHeaders({
        "Accept": "application/json",
        "Content-Type": "application/json;odata=verbose;charset=utf-8",
    }));

    t2.using(InjectHeaders({
        "Accept": "application/json",
        "Content-Type": "application/json;odata=verbose;charset=utf-8",
    }));

    // use the basic caching that mimics v2
    // t.using(Caching());

    // we can replace
    // t.on.send(NodeSend());
    // t.on.send(NodeSend(), "replace");

    // we can register multiple parse handlers to run in sequence
    // here we are doing some error checking??
    // TODO:: do we want a specific response validation step? seems maybe too specialized?
    t.on.parse(async function (url: string, response: Response, result: any) {

        if (!response.ok) {
            // within these observers we just throw to indicate an unrecoverable error within the pipeline
            throw await HttpRequestError.init(response);
        }

        return [url, response, result];
    });

    t2.on.parse(async function (url: string, response: Response, result: any) {

        if (!response.ok) {
            // within these observers we just throw to indicate an unrecoverable error within the pipeline
            throw await HttpRequestError.init(response);
        }

        return [url, response, result];
    });

    // we can register multiple parse handlers to run in sequence
    t.on.parse(async function (url: string, response: Response, result: any) {

        // only update result if not done?
        if (typeof result === "undefined") {
            result = await response.text();
        }

        // only update result if not done?
        if (typeof result !== "undefined") {
            result = JSON.parse(result);
        }

        return [url, response, result];
    });

    // we can register multiple parse handlers to run in sequence
    t2.on.parse(async function (url: string, response: Response, result: any) {

        // only update result if not done?
        if (typeof result === "undefined") {
            result = await response.text();
        }

        // only update result if not done?
        if (typeof result !== "undefined") {
            result = JSON.parse(result);
        }

        return [url, response, result];
    });

    // TODO:: must have a passthrough handler for each moment
    t.on.post(async (url, result) => [url, result]);
    t2.on.post(async (url, result) => [url, result]);

    try {

        t.start().then(d => {
            console.log(d)
        });
        t2.start().then(d => {
            console.log(d)
        });

        await execute();

    } catch (e) {
        console.error("fail");
        console.error(e);
    }



    // process.exit(0);
}
