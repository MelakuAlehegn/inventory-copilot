"""Inventory simulation engine.

Rolling replay of actual M5 demand against a policy's decisions, tracking fill
rate, stockout-days, units short, average on-hand, holding cost, order cost, and
total cost. Produces the headline decision-quality numbers and the service-vs-cost
Pareto frontier used to compare the base-stock policy against the naive baseline.
Also backs the what-if levers (lead time, service level, costs, demand shock, price).
"""
