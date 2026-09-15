# Problem Statement

## Background

At advanced semiconductor nodes such as 3nm and 5nm, even a small change in wafer yield can create major financial impact. A 1% yield drop can cost tens of millions of dollars per month because lost wafers increase scrap, rework, and throughput pressure while reducing the value captured from expensive fab capacity.

The challenge is not only to detect a failed wafer after it has already been produced. It is to understand where the problems are coming from across large sets of process signals and to identify batches that are likely to fail before they progress further through manufacturing.

## The Problem

The signals behind yield loss are spread across many places: equipment sensor readings, process parameters, wafer-level measurements, and defect observations. The data is high-volume, noisy, and often difficult to interpret manually. Root causes can remain hidden across thousands of variables, especially when the issue is caused by subtle process drift or recurring spatial defect patterns.

In practice, engineers must manually inspect historical data and current wafer records to determine whether a failure is caused by equipment deviation, parameter variation, or a recurring defect pattern. This slows down response time, creates inconsistent investigations, and increases the cost of poor yield.

## Who Is Affected

This problem directly affects:

- process engineers
- quality engineers
- manufacturing engineers
- production and operations teams

These stakeholders need faster visibility into wafer risk and a clearer way to explain which indicators most strongly correlate with poor yield.

## Why It Matters

Yield loss has a direct impact on cost, output, and delivery. Every day that a defect pattern or process deviation remains unexplained, more bad wafers can be produced. In a high-volume fab, the cost of delay is not only technical; it is commercial, operational, and strategic.

The problem is especially important because engineers also need to predict which future batches are at risk before they start running, rather than only reacting after yield has already dropped.

## Why Existing Approaches Fall Short

Most current approaches still rely on fragmented review of sensor data, batch summaries, and defect reports across separate views. This makes the problem difficult to scale and inconsistent from one investigation to the next. Manual review is slow, difficult to reproduce, and weak at surfacing which process signals matter most when yield begins to fall.

A practical solution needs to combine prediction and interpretation. Teams need a system that can assess wafer risk early, explain the strongest contributors behind a failure, and make the investigation path more actionable.

## Challenge Outcome

The project addresses the need to review wafer and batch data, identify likely process drivers, rank probable causes, and flag upcoming batches that may be at risk. It supports a workflow where engineers can:

- evaluate wafer-level pass/fail risk from sensor inputs
- screen multiple records with batch CSV analysis
- identify top contributing signals responsible for risky predictions
- review defect-pattern and root-cause views for operational investigation
- track corrective-action decisions within the dashboard workflow

This is the problem context for the IBM Bob Hackathon submission and the focus of the implemented solution in this repository.
