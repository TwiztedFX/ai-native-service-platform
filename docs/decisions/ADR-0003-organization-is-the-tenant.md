# ADR-0003: Organization is the tenant

- Status: accepted
- Date: 2026-10-03

## Decision

An organization is the tenant. Brands, reseller hierarchies, and custom domains are not modeled yet.

## Alternatives

- Create brand and reseller tables now and leave them unused.
- Use a shared schema with only application filters.

## Rationale

The first customer of the platform is the organization that owns the workspace. Unused hierarchy tables would imply a white-label product that is not built.

## Consequences

White-label work in phase 4 needs a new ADR and a migration. Membership roles are `owner`, `operator`, and `customer`.
