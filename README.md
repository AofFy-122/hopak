# Horganice - Apartment Management System

## Project Overview

Horganice is a comprehensive, full-stack property management application designed to streamline operations for apartment owners and enhance the living experience for tenants. The system features a role-based portal distinguishing between administrative controls and tenant functionalities, ensuring efficiency and transparency in property management.

## Key Features

- **Role-Based Access Control (RBAC):** Dedicated portals and dashboards for administrative users (owners) and tenants.
- **Tenant Management & Room Assignment:** Automated tenant profiling alongside seamless room assignment processes.
- **Dynamic Billing & Invoicing System:** Automated monthly invoice generation, integrating utility meters (water and electricity) and dynamic updates for pending payments.
- **Tenant Behavior Scoring:** An automated scoring mechanism that rewards timely payments and penalizes late submissions, visualized on an interactive dashboard widget with historical logs.
- **Maintenance Tracking:** A dedicated module for tenants to submit and monitor maintenance requests associated with their assigned rooms.

## Tech Stack

- **Framework:** Next.js (v16) / React (v19)
- **Language:** JavaScript
- **Styling:** Vanilla CSS
- **Database & Authentication:** Supabase (PostgreSQL)
- **Architecture:** Full-stack Serverless utilizing Next.js App Router

## Prerequisites

Before getting started, ensure you have the following installed on your local development environment:

- Node.js (v18.x or later recommended)
- npm, yarn, pnpm, or bun
- A Supabase account and project set up

## Getting Started

Follow these steps to set up the project locally:

1. **Clone the repository and install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

2. **Environment Variables:**

   Ensure you configure the `.env` file in the root directory of the project with your Supabase credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. **Access the application:**

   Open [http://localhost:3000](http://localhost:3000) in your web browser to view the application.

## Project Structure

- `/app`: Contains Next.js App Router pages and layouts.
- `/components`: Reusable UI components.
- `/contexts`: React contexts for global state management.
- `/lib`: Utility functions and Supabase client configuration.
- `/services`: External API and database service calls.
- `/styles`: Global and modular Vanilla CSS files.
- `/public`: Static assets.

## License

This project is proprietary and intended for private use.
