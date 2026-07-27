\# FleetNexus – Technology Stack

\*\*Document Version:\*\* 1.0.0

\*\*Status:\*\* Active

\*\*Last Updated:\*\* 16 July 2026

\*\*Owner:\*\* Koushik

\---

\# Purpose

This document defines the official technology stack for FleetNexus.

The objective is to maintain consistency throughout development and avoid unnecessary technology changes during implementation.

\---

\# System Architecture

FleetNexus follows a modern client-server architecture.

```text

Frontend (React)



↓



Backend API (NestJS)



↓



PostgreSQL Database



↓



Storage (Cloudinary / Local)



↓



AI Services



↓



External APIs

```

\---

\# Frontend

\## Framework

React 19

Reason:

\- Component-based

\- Large ecosystem

\- Excellent TypeScript support

\- Easy scalability

\---

\## Language

TypeScript

Reason:

\- Type safety

\- Better maintainability

\- Fewer runtime errors

\---

\## Styling

Tailwind CSS

Reason:

\- Fast UI development

\- Consistent design system

\- Responsive layouts

\---

\## State Management

Redux Toolkit

Reason:

\- Predictable state management

\- Scalable architecture

\---

\## Routing

React Router

\---

\# Backend

\## Framework

NestJS

Reason:

\- Enterprise architecture

\- Modular design

\- Dependency Injection

\- Excellent TypeScript support

\---

\## ORM

Prisma ORM

Reason:

\- Type-safe database queries

\- Easy migrations

\- Excellent developer experience

\---

\# Database

PostgreSQL

Reason:

FleetNexus manages highly relational data.

Examples include:

\- Trips

\- Drivers

\- Vehicles

\- Payments

\- Documents

\- Organizations

PostgreSQL provides excellent relational integrity and scalability.

\---

\# Authentication

JWT Authentication

Role-Based Access Control (RBAC)

Supported Roles:

\- Admin

\- Factory Manager

\- Union Manager

\- Fleet Owner

\- Driver

\---

\# File Storage

Cloudinary (Production)

Local Storage (Development)

Used for:

\- Fuel Receipts

\- POD

\- Vehicle Images

\- Driver Documents

\---

\# AI

OpenAI / Gemini APIs

Planned Features:

\- AI Assistant

\- OCR Processing

\- Business Insights

\- Smart Search

\---

\# OCR

Google Vision API

Future alternatives:

\- Azure Vision

\- AWS Textract

\---

\# GPS

Google Maps Platform

Future integrations:

\- GPS Device APIs

\- Vehicle Tracking APIs

\---

\# Notifications

Firebase Cloud Messaging

Future:

\- WhatsApp

\- SMS

\- Email

\---

\# Payments

Phase 1:

Manual Entry

Future:

\- UPI Integration

\- Payment Gateway

\- FASTag

\---

\# Deployment

Frontend

Vercel

Backend

Railway / Render

Database

Neon PostgreSQL

\---

\# Development Tools

VS Code / Cursor

Git

GitHub

Postman

Docker (Future)

\---

\# Future Technologies

\- Redis

\- Kafka

\- Kubernetes

\- Elasticsearch

\- Prometheus

\- Grafana

These technologies will only be introduced if required by future scalability needs.

\---

\# Technology Principles

FleetNexus prioritizes:

\- Simplicity

\- Scalability

\- Maintainability

\- Security

\- Performance

\- Developer Productivity

Technology choices should always support these principles.
