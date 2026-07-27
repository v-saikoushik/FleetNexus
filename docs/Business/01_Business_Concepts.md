\# FleetNexus – Business Concepts

\*\*Document Version:\*\* 1.0.0

\*\*Status:\*\* Draft

\*\*Last Updated:\*\* 13 July 2026

\*\*Owner:\*\* Koushik

\---

\# Purpose

This document explains how the Indian road transport business operates in the real world.

Unlike product documentation, this document focuses entirely on business knowledge. It describes the people, processes, documents, relationships, and operational practices that FleetNexus aims to digitize.

This document serves as the foundation for all future product, database, API, and system design decisions.

\---

\# Table of Contents

1\. Industry Overview

2\. Business Stakeholders

3\. Transportation Lifecycle

\---

\# Chapter 1 – Industry Overview

\## Introduction

Road transportation is one of the most important components of India's logistics ecosystem.

Every day, thousands of factories, warehouses, distributors, and transport companies coordinate the movement of goods between locations.

Despite advances in technology, many transport businesses still rely on paper registers, phone calls, spreadsheets, and messaging applications to manage operations.

This creates inefficiencies, increases operational costs, and makes business growth difficult.

FleetNexus aims to understand these existing workflows before introducing digital solutions.

\---

\## How the Industry Operates

A transportation request generally begins when a factory, warehouse, or dealer needs to move goods from one location to another.

The organization creating the shipment identifies:

\- Material

\- Quantity

\- Pickup location

\- Delivery location

\- Truck requirements

\- Schedule

\- Transport rate

Once these details are finalized, transportation resources are arranged either directly or through a lorry union.

After allocation, a truck reports for loading, transports the goods, completes delivery, submits required documents, and closes the trip through financial settlement.

Although this process appears simple, every stage generates operational data, paperwork, expenses, and communication.

FleetNexus aims to digitize this complete lifecycle.

\---

\# Chapter 2 – Business Stakeholders

FleetNexus currently models four primary stakeholders.

\## Factory / Dealer / Transport Manager

Creates transportation demand.

Responsibilities include:

\- Planning dispatches

\- Creating load requests

\- Defaining shipment requirements

\- Tracking deliveries

\- Processing transporter payments

\---

\## Lorry Union

Acts as a transport coordinator.

Typical responsibilities:

\- Maintain truck series

\- Register members

\- Allocate trips

\- Manage availability

\- Ensure transparency

\- Maintain allocation history

\---

\## Fleet Owner

Owns and manages transport vehicles.

Responsible for:

\- Vehicles

\- Drivers

\- Expenses

\- Maintenance

\- Documents

\- Trips

\- Payments

\- Profitability

\---

\## Driver

Executes transportation.

Typical responsibilities:

\- Report for loading

\- Transport goods safely

\- Collect required documents

\- Submit expenses

\- Complete delivery

\- Report issues during trips

The driver application should remain simple and require minimal manual interaction.

\---

\# Chapter 3 – Transportation Lifecycle

A transport operation generally follows the sequence below.

1\. Customer requires transportation.

2\. Factory creates a transport request.

3\. Truck requirement is either allocated directly or sent to the union.

4\. Union allocates trucks according to operational rules.

5\. Fleet owner accepts the assignment.

6\. Driver reports to the loading location.

7\. Goods are loaded.

8\. Required documents are issued.

9\. Transportation begins.

10\. Fuel, toll, maintenance, and other operational expenses occur during the journey.

11\. Goods reach the destination.

12\. Goods are unloaded.

13\. Proof of Delivery (POD) is collected.

14\. Payment and financial settlement are completed.

15\. Trip is officially closed.

\---

\# Version Notes

This document represents Version 1.0 of the FleetNexus business knowledge base.

Future versions will expand this document with:

\- Union operations

\- Financial workflows

\- Business documents

\- Payment lifecycle

\- Transport terminology

\- Operational challenges

\- Technology opportunities
---

\# Chapter 4 – Business Documents

Every transport trip generates multiple business documents. These documents serve as legal proof, financial records, and operational evidence throughout the transportation lifecycle.

FleetNexus aims to digitally organize, store, and manage these documents while reducing manual paperwork.

\## Common Business Documents

\### Load Request

Created by the factory or transport manager to request vehicles.

Contains:

\- Material

\- Quantity

\- Pickup location

\- Destination

\- Required truck type

\- Number of vehicles

\- Expected loading date

\- Freight rate

\---

\### Loading Slip

Issued when goods are loaded onto the vehicle.

Contains:

\- Vehicle number

\- Driver name

\- Material details

\- Quantity

\- Gross weight

\- Loading date and time

\- Factory authorization

\---

\### Lorry Receipt (LR / Bilty)

Acts as proof that the transporter has accepted the goods for transportation.

Contains:

\- Consignor

\- Consignee

\- Material

\- Vehicle details

\- Freight details

\- Dispatch information

\---

\### Fuel Receipt

Generated whenever fuel is purchased during a trip.

Future FleetNexus Feature:

\- Capture photo

\- Extract details using OCR

\- Automatically attach to the trip and vehicle

\---

\### Toll Receipt

Proof of toll payment.

Future FleetNexus Feature:

\- OCR extraction

\- Auto-categorize as trip expense

\---

\### Maintenance Bill

Generated whenever repairs or servicing occur.

Examples:

\- Tyre replacement

\- Engine repair

\- Oil change

\- Brake work

\- Battery replacement

\---

\### Proof of Delivery (POD)

Collected after successful unloading.

The POD confirms that the shipment has reached the destination.

It is one of the most important transport documents.

\---

\### Invoice

Issued after successful completion of transportation.

Used for payment settlement between transporter and customer.

\---

\# Chapter 5 – Money Flow

Transport operations involve multiple financial transactions throughout a trip.

FleetNexus aims to capture every transaction digitally.

\## Typical Payment Flow

Factory / Customer

↓

Freight Payment

↓

Fleet Owner

↓

Trip Expenses

↓

Driver Settlement

↓

Final Profit

\---

\## Common Expenses

A trip may include:

\- Fuel

\- Toll

\- Driver Advance

\- Food Allowance

\- Repairs

\- Tyre Damage

\- Parking Charges

\- Loading Charges

\- Unloading Charges

\- Union Charges

\- Miscellaneous Expenses

Every expense should be linked to both the Trip and the Vehicle.

\---

\## Payment Challenges

Current challenges include:

\- Cash payments

\- Missing receipts

\- Delayed customer payments

\- Manual calculations

\- Difficult profit analysis

FleetNexus aims to centralize these transactions for better visibility.

\---

\# Chapter 6 – Union Operations

Lorry unions play an important role in allocating transportation work among registered members.

Many unions currently maintain this process manually using registers and local rules.

FleetNexus aims to digitize this workflow without changing the underlying business process.

\## Typical Workflow

1\. Factory submits transport request.

2\. Union receives the request.

3\. Available trucks are identified.

4\. Allocation follows the union's queue or series.

5\. Fleet owners receive notifications.

6\. Owners accept or reject the trip.

7\. Assigned vehicles are confirmed.

8\. Allocation history is recorded.

\---

\## Benefits of Digitization

\- Transparent allocation

\- Reduced disputes

\- Complete allocation history

\- Faster communication

\- Improved planning

\---

\# Chapter 7 – Operational Challenges

Common challenges observed in transport businesses include:

\- Paper registers

\- WhatsApp-based communication

\- Lost receipts

\- Manual bookkeeping

\- Delayed payment tracking

\- Poor maintenance records

\- Limited visibility into vehicle profitability

\- Difficulty tracking driver history

\- Duplicate data entry

\- Lack of centralized information

These operational issues increase costs and reduce efficiency.

\---

\# Chapter 8 – Technology Opportunities

FleetNexus is designed to improve existing workflows through practical technology.

Potential opportunities include:

\- OCR-based document digitization

\- AI-powered business insights

\- Automated reminders

\- GPS integration

\- Digital trip management

\- Driver mobile application

\- Predictive maintenance

\- Financial dashboards

\- Digital document vault

\- Multi-language support

\- Smart notifications

The objective is not to replace existing business practices, but to simplify them using modern software while respecting the industry's operational realities.

\---

\# Version Notes

Version 1.0 establishes the foundational understanding of the transport business.

Future versions will incorporate:

\- Real-world observations

\- Industry feedback

\- Regulatory updates

\- Additional transport workflows

\- Advanced logistics concepts
