/**
 * Storage Notifications Component
 *
 * Displays floating notifications for storage-related events.
 */
import React from "react";
import { Notification } from "@mantine/core";

export const StorageNotifications = ({ notifications, setNotifications }) => {
  return (
    <div
      style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1000 }}
    >
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          color={
            notification.type === "error"
              ? "red"
              : notification.type === "success"
              ? "green"
              : "blue"
          }
          onClose={() =>
            setNotifications((prev) =>
              prev.filter((n) => n.id !== notification.id)
            )
          }
          mb="xs"
        >
          {notification.message}
        </Notification>
      ))}
    </div>
  );
};