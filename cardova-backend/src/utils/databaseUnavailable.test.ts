import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDatabaseUnavailable } from "./databaseUnavailable.js";

describe("isDatabaseUnavailable", () => {
  it("treats an empty-password database client error as unavailable", () => {
    assert.equal(
      isDatabaseUnavailable({
        message: "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string",
      }),
      true
    );
  });

  it("does not treat an ordinary lookup failure as unavailable", () => {
    assert.equal(isDatabaseUnavailable(new Error("column does not exist")), false);
  });
});