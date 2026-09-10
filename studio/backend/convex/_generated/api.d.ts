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
import type * as gmail from "../gmail.js";
import type * as gmailConnections from "../gmailConnections.js";
import type * as gmailInternal from "../gmailInternal.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_bookingCommands from "../lib/bookingCommands.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_createClient from "../lib/createClient.js";
import type * as lib_gmailMessage from "../lib/gmailMessage.js";
import type * as lib_gmailProvider from "../lib/gmailProvider.js";
import type * as lib_gmailSecurity from "../lib/gmailSecurity.js";
import type * as lib_practiceDay from "../lib/practiceDay.js";
import type * as lib_settings from "../lib/settings.js";
import type * as migrations from "../migrations.js";
import type * as services from "../services.js";
import type * as settings from "../settings.js";
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
  gmail: typeof gmail;
  gmailConnections: typeof gmailConnections;
  gmailInternal: typeof gmailInternal;
  "lib/access": typeof lib_access;
  "lib/bookingCommands": typeof lib_bookingCommands;
  "lib/catalog": typeof lib_catalog;
  "lib/createClient": typeof lib_createClient;
  "lib/gmailMessage": typeof lib_gmailMessage;
  "lib/gmailProvider": typeof lib_gmailProvider;
  "lib/gmailSecurity": typeof lib_gmailSecurity;
  "lib/practiceDay": typeof lib_practiceDay;
  "lib/settings": typeof lib_settings;
  migrations: typeof migrations;
  services: typeof services;
  settings: typeof settings;
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
