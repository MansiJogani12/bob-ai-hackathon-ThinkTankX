# Problem Statement

## Background

Modern semiconductor manufacturing operates at extremely small process nodes, including 3nm and 5nm. At these advanced geometries, even a small reduction in yield can have a major financial impact. A 1% drop in yield can cost tens of millions of dollars per month because each lost wafer, reduced throughput, and rework cycle increases cost and reduces production output.

The yield challenge is not only about detecting a failed wafer after the fact. It is about understanding why yield is falling, where the issue originates, and which upcoming batches are likely to be at risk before they fail in production.

## The Problem

The relevant signals are spread across many sources: wafer and lot records, equipment sensor readings, process parameters, defect reports, and wafer-map or inspection information. Root causes are often hidden across thousands of variables and may only become visible when they interact across tools, process steps, and manufacturing lots.

In practice, engineers are forced to manually review large volumes of noisy data to determine whether a problem is caused by equipment drift, process variation, recurring defect signatures, or a combination of these factors. This process is slow, inconsistent, and costly. Every day of delay translates into scrap, lost revenue, and missed output.

## Who is Affected

This problem affects the people responsible for production stability and quality in semiconductor manufacturing, particularly:

- process engineers
- quality engineers
- manufacturing engineers
- production and operations teams

These stakeholders need faster visibility into risk and clearer explanations for failures so they can act before yield drops further and after a defect is identified.

## Why It Matters

Yield loss matters because it directly impacts cost, throughput, and product delivery. At leading-edge process nodes, even a modest yield decline can create significant financial consequences. More importantly, delayed root-cause analysis means lost opportunities to stop recurring issues before they escalate across multiple lots.

## Why Existing Approaches Fall Short

Traditional methods are often manual and fragmented. Engineers may review historical records, compare process conditions, and inspect defect reports across separate data sources to infer the cause of poor yield. This approach is difficult to scale, difficult to repeat consistently, and too slow for high-volume manufacturing environments.

The challenge is therefore not only to detect failed wafers after the fact, but to identify risk early and explain the likely contributing factors when a defect appears. Teams need a way to connect warning signals across process history and defect patterns to make faster, more informed decisions.

## The challenge addressed by the solution

The specific challenge is to analyse wafer lot data and defect reports to identify patterns, rank likely root causes by probability, recommend corrective actions, and flag upcoming batches whose process parameters historically correlate with low yield.

This requires a system that can:

- process multi-source manufacturing data
- detect risk patterns across wafer and batch history
- rank probable causes instead of relying on manual review alone
- support corrective-action decisions
- flag at-risk lots before failure occurs
- explain likely contributing factors after a defect is observed

This is the problem the project addresses within the IBM Bob Hackathon context.
