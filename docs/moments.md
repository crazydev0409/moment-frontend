# Moments App Architecture

## Overview
This document outlines the architecture of the Moments frontend application.

## Main Components

- **UI Layer**
  - Built with React and TypeScript
  - Uses component-based structure for reusability

- **State Management**
  - Uses context API for local state management that doesn't frequently change such as authentication state
  - Utilizes Redux Toolkit for global state for managing all other application states

- **Routing**
  - React Router for client-side navigation

- **API Integration**
  - Axios for HTTP requests
  - Centralized API service layer

- **Styling**
  - Tailwind CSS for utility-first styling
  - Theme support for light/dark modes

## Folder Structure

```
/docs -> documentation files
/assets -> static assets such as images and icons
/src
  /__tests__ -> unit and integration tests
  /components -> reusable UI components
  /screens -> application routes
  /redux -> Redux slices and store configuration
  /authBase -> authentication and authorization logic
  /test-utils -> utilities for testing
```
## Authentication Structure
State management done using useContext and useReducer hooks. This design pattern is used -> https://react.dev/learn/scaling-up-with-reducer-and-context
We use async storage to persist the auth state across app restarts. Such as storing the JWT token and user information.

### Registration Flow

### Login Flow


## Navigation Structure

## Deployment

