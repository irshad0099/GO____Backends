# Go Mobility Backend

**Project:** Go-Mobility-Backend  
**Description:** Backend for a ride-hailing app like Ola, Uber, Rapido. Supports multi-city, multi-district, and "Book for Someone Else" feature. Includes drivers, rides, vehicles, payments, and real-time location tracking using Redis.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Database Structure](#database-structure)
4. [Redis Usage](#redis-usage)
5. [API Endpoints](#api-endpoints)
6. [Setup Instructions](#setup-instructions)
7. [Environment Variables](#environment-variables)
8. [Folder Structure](#folder-structure)
9. [System Design](#system-design)
10. [Future Enhancements](#future-enhancements)

---

## Features

- Multi-city, district, state ride booking
- Book rides for someone else
- Real-time driver location tracking
- Vehicle type selection (Bike / Auto / Car)
- Ride status management (Searching, Assigned, Ongoing, Completed, Cancelled)
- Payment options (Cash / Online)
- Service availability check per city/state
- Redis-based geo-location for nearby drivers
- Role-based access (Rider / Driver)

---

## Tech Stack

- **Backend:** Go (Golang) / Node.js (TypeScript optional)
- **Database:** PostgreSQL
- **Cache / Real-time:** Redis
- **Messaging / Queue:** Kafka (Optional for driver notifications)
- **Containerization:** Docker
- **Deployment:** AWS / GCP

---

## Database Structure

### Users

```sql
id UUID PRIMARY KEY
name VARCHAR
phone VARCHAR UNIQUE
role VARCHAR CHECK ('RIDER','DRIVER')
```
