## Packages
recharts | Dashboard analytics and queue visualization
date-fns | Date formatting and manipulation for appointments
framer-motion | Smooth transitions and animations for queue updates
react-day-picker | Calendar component for appointment scheduling
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes
lucide-react | Icons for the UI

## Notes
- Using Replit Auth for authentication (already set up in backend)
- Tailwind Config needs to extend font families for 'sans' (Inter/DM Sans) and 'display' (Outfit/Plus Jakarta Sans)
- Dashboard uses Recharts for queue statistics
- Real-time updates simulation via polling (TanStack Query refetchInterval) since WebSocket wasn't explicitly requested but highly beneficial for queues
