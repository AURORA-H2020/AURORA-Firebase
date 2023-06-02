import { RulesTestContext, RulesTestEnvironment } from "@firebase/rules-unit-testing";

/**
 * A TestContextProvider
 */
export type TestContextProvider = () => TestContext;

/**
 * A TestContext composition of AuthenticatedTestContext and UnauthenticatedTestContext
 */
export type TestContext = AuthenticatedTestContext & UnauthenticatedTestContext;

/**
 * An AuthenticatedTestContextProvider
 */
export type AuthenticatedTestContextProvider = () => AuthenticatedTestContext;

/**
 * An AuthenticatedTestContext
 */
export interface AuthenticatedTestContext {
  testEnvironment: RulesTestEnvironment;
  authenticatedContextUserId: string;
  authenticatedContext: () => RulesTestContext;
}

/**
 * An UnauthenticatedTestContextProvider
 */
export type UnauthenticatedTestContextProvider = () => UnauthenticatedTestContext;

/**
 * An UnauthenticatedTestContext
 */
export interface UnauthenticatedTestContext {
  unauthenticatedContext: () => RulesTestContext;
}
