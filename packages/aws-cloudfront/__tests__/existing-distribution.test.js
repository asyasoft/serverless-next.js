const {
  createComponent,
  assertHasOrigin,
  assertHasOriginCount,
  assertHasCacheBehavior
} = require("../test-utils");

const {
  mockCreateDistribution,
  mockUpdateDistribution,
  mockGetDistributionConfigPromise,
  mockUpdateDistributionPromise
} = require("aws-sdk");

jest.mock("aws-sdk", () => require("../__mocks__/aws-sdk.mock"));

describe("Working with an existing distribution", () => {
  let component;

  beforeEach(async () => {
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Origins: {
          Quantity: 0,
          Items: []
        }
      }
    });
    mockUpdateDistributionPromise.mockResolvedValueOnce({
      Distribution: {
        Id: "xyz"
      }
    });

    component = await createComponent();
  });

  it("should not create a new distribution", async () => {
    await component.default({
      distributionId: "abc",
      origins: ["https://exampleorigin.com"]
    });

    expect(mockCreateDistribution).not.toBeCalled();
  });

  it("should update the existing distribution by ID", async () => {
    await component.default({
      distributionId: "fake-distribution-id",
      origins: ["https://exampleorigin.com"]
    });

    expect(mockUpdateDistribution).toBeCalledWith(
      expect.objectContaining({
        Id: "fake-distribution-id"
      })
    );
  });

  it("should add the new origin to the distribution", async () => {
    mockGetDistributionConfigPromise.mockReset();
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Origins: {
          Quantity: 1,
          Items: [
            { Id: "existingorigin.com", DomainName: "existingorigin.com" }
          ]
        }
      }
    });

    await component.default({
      distributionId: "fake-distribution-id",
      origins: ["https://neworigin.com"]
    });

    // any existing origins are kept
    assertHasOrigin(mockUpdateDistribution, {
      Id: "existingorigin.com",
      DomainName: "existingorigin.com"
    });

    assertHasOrigin(mockUpdateDistribution, {
      Id: "neworigin.com",
      DomainName: "neworigin.com"
    });

    assertHasOriginCount(mockUpdateDistribution, 2);
  });

  it("should modify the existing origin by adding a new cache behavior", async () => {
    mockGetDistributionConfigPromise.mockReset();
    mockGetDistributionConfigPromise.mockResolvedValueOnce({
      ETag: "etag",
      DistributionConfig: {
        Origins: {
          Quantity: 1,
          Items: [
            { Id: "existingorigin1.com", DomainName: "existingorigin1.com" },
            { Id: "existingorigin2.com", DomainName: "existingorigin2.com" }
          ]
        }
      }
    });

    await component.default({
      distributionId: "fake-distribution-id",
      origins: [
        {
          url: "https://existingorigin2.com",
          pathPatterns: {
            "/some/path": {
              ttl: 10
            }
          }
        }
      ]
    });

    assertHasOrigin(mockUpdateDistribution, {
      Id: "existingorigin1.com",
      DomainName: "existingorigin1.com"
    });

    assertHasOrigin(mockUpdateDistribution, {
      Id: "existingorigin2.com",
      DomainName: "existingorigin2.com"
    });

    assertHasCacheBehavior(mockUpdateDistribution, {
      PathPattern: "/some/path",
      MinTTL: 10,
      TargetOriginId: "existingorigin2.com"
    });
  });
});