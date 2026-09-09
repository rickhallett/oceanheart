/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookings from "../bookings.js";
import type * as clients from "../clients.js";
import type * as enquiries from "../enquiries.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_bookingCommands from "../lib/bookingCommands.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_createClient from "../lib/createClient.js";
import type * as migrations from "../migrations.js";
import type * as services from "../services.js";
import type * as tasks from "../tasks.js";
import type * as tenants from "../tenants.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookings: typeof bookings;
  clients: typeof clients;
  enquiries: typeof enquiries;
  "lib/access": typeof lib_access;
  "lib/bookingCommands": typeof lib_bookingCommands;
  "lib/catalog": typeof lib_catalog;
  "lib/createClient": typeof lib_createClient;
  migrations: typeof migrations;
  services: typeof services;
  tasks: typeof tasks;
  tenants: typeof tenants;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
