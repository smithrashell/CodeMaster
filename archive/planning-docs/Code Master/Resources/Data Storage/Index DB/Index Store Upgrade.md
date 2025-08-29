
The error you're encountering, "Failed to execute 'transaction' on 'IDBDatabase': A version change transaction is running," typically occurs when you attempt to start a new transaction within an `onupgradeneeded` event handler while the database is already undergoing a version change. In IndexedDB, `onupgradeneeded` itself is a transaction, specifically tailored for updating the database's schema, which includes creating and deleting object stores or indexes.

Here’s a conceptual fix:

**Avoid Starting a New Transaction Inside `onupgradeneeded`**

You don't need to explicitly start a transaction within the `onupgradeneeded` event to create or update stores and indexes. The `event.target.transaction` in `onupgradeneeded` provides you the transaction you need to modify the database schema.

Here’s how you should structure your code to add an index or modify the database schema:

```javascript
function openDatabase() {
    const request = indexedDB.open('MyDatabase', 2); // Assuming version 1 is already created, upgrade to version 2

    request.onupgradeneeded = function(event) {
        const db = event.target.result;

        // Check if the objectStore already exists
        if (!db.objectStoreNames.contains('myObjectStore')) {
            db.createObjectStore('myObjectStore', { keyPath: 'id' });
        }

        // Access the objectStore to create an index
        const transaction = event.target.transaction;
        const store = transaction.objectStore('myObjectStore');

        // Create a new index if it doesn't exist
        if (!store.indexNames.contains('myNewIndex')) {
            store.createIndex('myNewIndex', 'propertyName', { unique: false });
        }
    };

    request.onsuccess = function(event) {
        console.log('Database opened/updated successfully');
        const db = event.target.result;
        db.close(); // Close the connection once done
    };

    request.onerror = function(event) {
        console.error('Database error: ', event.target.errorCode);
    };
}

openDatabase();
```

### Key Points:
- **Do Not Start a New Transaction**: In the `onupgradeneeded` method, use the transaction provided by `event.target.transaction`. You do not need to explicitly start another one.
- **Use `createIndex` Directly**: You can directly call `createIndex` on the `IDBObjectStore` instance if the index does not already exist. This method is automatically part of the upgrade transaction.
- **Error Handling**: Always implement `onerror` handlers on your request to manage errors effectively.

By adhering to this approach, you can modify your database schema within the constraints of the IndexedDB transaction model without encountering errors related to concurrent transactions during a version upgrade.