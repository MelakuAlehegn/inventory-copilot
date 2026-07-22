"""Inventory policy.

Periodic-review order-up-to (base-stock) policy: computes the order-up-to level S
covering lead-time + review-period demand at a target service level, using the
forecast's quantiles of lead-time demand. Includes the fair naive baseline and the
documented, user-adjustable economics (lead time, review period, holding cost,
order cost, service level).
"""
