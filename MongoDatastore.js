/**
                                 
 _____ _____ _     _           _ 
|  __ |     |_|___| |_ ___ ___| |
| |___| | | | |  _|   | .'| -_| |
|_____|_|_|_|_|___|_|_|__,|___|_|
 *
 * @class MongoDataStore
 * @author Michael
 * @since May 7th, 2026
 * 
 * @description This module is for constructing classes that connect to a MongoDB database. Then, methods through getDatastore 
 * are provided for convenient datastore manipulation.
 */
import * as mongodb from 'mongodb';
import {EventEmitter} from 'node:events';

export const MongoDatastore = class extends EventEmitter {
    /**
     *                                  
    _____     _   _   _             
    |   __|___| |_| |_|_|___ ___ ___ 
    |__   | -_|  _|  _| |   | . |_ -|
    |_____|___|_| |_| |_|_|_|_  |___|
                            |___|    
     */
    static Events = {
        error: `error`,
        connected: `clientConnected`,
        dbConnected: `datastoreConnected`,
        retry: `retryingConnection`,
        operationStart: `operationStart`, operationEnd: `operationEnd`,
        operationError: `operationError`,
    }
    static Settings = {
        version: `0.0.1`, database: `main`,
        maxRetries: 5, retryDelay: 250
    } 
    
    /**
     ____      _               _         
    |    \ ___| |_ _ _ ___ ___|_|___ ___ 
    |  |  | -_| . | | | . | . | |   | . |
    |____/|___|___|___|_  |_  |_|_|_|_  |
                    |___|___|     |___|
     *
     * Metric functions provided to tell how long each method,
     * and unless stated otherwise, function, lasts while executing. 
     */
    metricsEnabled = false;
    setLogger(logger) {
        this.logger = logger;
    }

    log(level, message, meta = {}) {
        if (this.logger && typeof this.logger[level] === `function`) {
            this.logger[level](message, meta);
        }
    }

    async timeOperation(name, fn) {
        const start = performance.now();
        this.emit(MongoDatastore.Events.operationStart, { name, start });

        try {
            const result = await fn();
            const end = performance.now();
            const duration = end - start;

            this.emit(MongoDatastore.Events.operationEnd, { name, duration });
            this.log(`info`, `Operation ${name} completed`, { duration });

            return result;

        } catch (error) {
            const end = performance.now();
            const duration = end - start;

            this.emit(MongoDatastore.Events.operationError, { name, duration, error });
            this.log(`error`, `Operation ${name} failed`, { duration, error });

            throw error;
        }
    }

    /**       
     _____     _     
    |     |___|_|___ 
    | | | | .'| |   |
    |_|_|_|__,|_|_|_|
     *           
     */
    connected = false; client; datastores = new Map();
    keysAreObjectId = false;

    /**
     * Constructs a new client and then attempts to connect to MongoDb.
     * @param {string} url - The url of the MongoDb cluster.
     * @param {boolean} keysAreObject - Whether keys should be parsed as Objects (true) or strings (false).
     */
    constructor(url = `mongodb://localhost:27017`, keysAreObject = false) {
        super();
        this.client = new mongodb.MongoClient(url, {
            tls: MongoDatastore.Settings.TLS ?? true, maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000, socketTimeoutMS: 30000, 
        });
        this.keysAreObjectId = keysAreObject;
        this.init();
    }

    parseKey(key) {
        return this.keysAreObjectId ? new mongodb.ObjectId(key) : key;
    } 

    /**
     * Attempts to connect to MongoDB & initalizes the main database.
     * @returns The client that is connected to MongoDB.
     */
    async init() {
        if (this.connected) return this.client;
        let attempt = 0;
        while (attempt < MongoDatastore.Settings.maxRetries) {
            try {
                attempt++;
                await this.client.connect();
                this.connected = true;
                this.emit(MongoDatastore.Events.connected, this.client, attempt);
                return this.client;
            } catch (error) {
                this.emit(MongoDatastore.Events.retry, {
                    attempt,
                    error,
                });

                if (attempt >= MongoDatastore.Settings.maxRetries) {
                    this.emit(MongoDatastore.Events.error, error);
                    throw error;
                }

                const delay = MongoDatastore.Settings.retryDelay * Math.pow(2, attempt - 1);
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }

    async close() {
        await this.client.close();
    }

    /**
     * 
     * @param {*} datastoreName - The datastore to connect to. 
     * @returns {{
     *   getAsync: (key: string|ObjectId) => Promise<any>,
     *   setAsync: (key: string|ObjectId, value: any) => Promise<boolean>,
     *   updateAsync: (key: string|ObjectId, callback: (oldValue: any) => any|Promise<any>) => Promise<any>,
     *   removeAsync: (key: string|ObjectId) => Promise<boolean>,
     *
     *   lists: {
     *     getAllAsync: (filter?: object, sort?: object|null) => Promise<object[]>,
     *     getOneAsync: (filter: object) => Promise<object|null>,
     *     insertAsync: (document: object) => Promise<object>,
     *     updateAsync: (filter: object, update: object) => Promise<boolean>,
     *     deleteAsync: (filter: object) => Promise<boolean>
     *   }
     * }}
     */
    async getDatastore(datastoreName) {
        if (this.datastores.has(datastoreName)) {
            return this.datastores.get(datastoreName);
        }

        await this.init();
        const databaseName = MongoDatastore.Settings.database;
        const datastore = this.client.db(databaseName);

        this.emit(MongoDatastore.Events.dbConnected, datastore);
        const collection = datastore.collection(datastoreName);

        const methods = {
            getAsync: async (key) => {
                return this.timeOperation(`${datastoreName}.get`, async () => {
                    const _id = this.parseKey(key);
                    const doc = await collection.findOne({ _id });
                    return doc?.value ?? null;
                });
            },

            setAsync: async (key, value) => {
                return this.timeOperation(`${datastoreName}.set`, async () => {
                    const _id = this.parseKey(key);
                    await collection.updateOne({ _id }, { $set: { value } }, { upsert: true });
                    return true;
                });
            },

            updateAsync: async (key, callback) => {
                return this.timeOperation(`${datastoreName}.update`, async () => {
                    const _id = this.parseKey(key);
                    const session = this.client.startSession();
                    let result;

                    try {
                        await session.withTransaction(async () => {
                            const doc = await collection.findOne({ _id }, { session });
                            const oldValue = doc?.value ?? null;
                            const newValue = await callback(oldValue);

                            await collection.updateOne(
                                { _id },
                                { $set: { value: newValue } },
                                { upsert: true, session }
                            );

                            result = newValue;
                        });
                    } finally {
                        await session.endSession();
                    }

                    return result;
                });
            },

            removeAsync: async (key) => {
                return this.timeOperation(`${datastoreName}.remove`, async () => {
                    const _id = this.parseKey(key);
                    const res = await collection.deleteOne({ _id });
                    return res.deletedCount > 0;
                });
            },

            lists: {
                getAllAsync: async (filter = {}, sort = null) => {
                    return this.timeOperation(`${datastoreName}.list.getAll`, async () => {
                        let cursor = collection.find(filter);
                        if (sort) cursor = cursor.sort(sort);
                        return await cursor.toArray();
                    });
                },

                getOneAsync: async (filter) => {
                    return this.timeOperation(`${datastoreName}.list.getOne`, async () => {
                        return await collection.findOne(filter);
                    });
                },

                insertAsync: async (document) => {
                    return this.timeOperation(`${datastoreName}.list.insert`, async () => {
                        const result = await collection.insertOne(document);
                        return { ...document, _id: result.insertedId };
                    });
                },

                updateAsync: async (filter, update) => {
                    return this.timeOperation(`${datastoreName}.list.update`, async () => {
                        await collection.updateOne(filter, { $set: update });
                        return true;
                    });
                },

                deleteAsync: async (filter) => {
                    return this.timeOperation(`${datastoreName}.list.delete`, async () => {
                        const result = await collection.deleteOne(filter);
                        return result.deletedCount > 0;
                    });
                }
            }
        };
        this.datastores.set(datastoreName, methods);
        return methods;
    }

}
