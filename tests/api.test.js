const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/user');

test('registration, login, validation, and atomic leave deductions', async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/leave-management-test', { serverSelectionTimeoutMS: 5000 });
    const email = `regression-${Date.now()}@example.com`;
    let server;
    try {
        await User.init();
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const request = async (path, body) => {
            const response = await fetch(base + path, body === undefined ? {} : {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            return { status: response.status, body: await response.json() };
        };
        assert.equal((await fetch(base)).status, 200);
        assert.equal((await fetch(base + '/style.css')).status, 200);
        const registration = { username: 'Regression User', email, rollNumber: 'TEST', casualLeave: 10, medicalLeave: 5 };
        for (const balance of [-1, 1.5, '10', null]) {
            assert.equal((await request('/api/register', { ...registration, casualLeave: balance })).status, 400);
        }
        assert.equal((await request('/api/register', {})).status, 400);
        const registered = await request('/api/register', registration);
        assert.equal(registered.status, 201);
        const id = registered.body.userId;
        assert.equal((await request('/api/register', registration)).status, 409);
        assert.equal((await request('/api/login', { email: email.toUpperCase() })).body.userId, id);
        assert.equal((await request('/api/leave-balance/invalid')).status, 400);
        assert.equal((await request(`/api/leave-balance/${new mongoose.Types.ObjectId()}`)).status, 404);
        for (const days of [0, -1, 1.5, true, '2']) {
            assert.equal((await request(`/api/apply-leave/${id}`, { type: 'casual', days })).status, 400);
        }
        assert.equal((await request(`/api/apply-leave/${id}`, { type: 'other', days: 1 })).status, 400);
        const applied = await request(`/api/apply-leave/${id}`, { type: 'casual', days: 3 });
        assert.equal(applied.body.casualLeave, 7);
        assert.equal(applied.body.medicalLeave, 5);
        assert.equal((await request(`/api/apply-leave/${id}`, { type: 'casual', days: 8 })).status, 400);
        const concurrent = await Promise.all([1, 2].map(() => request(`/api/apply-leave/${id}`, { type: 'casual', days: 5 })));
        assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 400]);
        assert.equal((await request(`/api/apply-leave/${id}`, { type: 'medical', days: 2 })).body.medicalLeave, 3);
        assert.deepEqual((await request(`/api/leave-balance/${id}`)).body, { casualLeave: 2, medicalLeave: 3 });
        const malformed = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.json()).message, 'Invalid JSON request');
        console.log('Verified: 10 casual days - 3 requested days = 7 remaining days.');
    } finally {
        await User.deleteMany({ email });
        if (server) await new Promise(resolve => server.close(resolve));
        await mongoose.disconnect();
    }
});
