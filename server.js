const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
const localMongoUri = 'mongodb://localhost:27017/luxestay';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || localMongoUri;
const port = process.env.PORT || 4000;
const isVercel = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

mongoose.set('strictQuery', false);

if (isVercel && !process.env.MONGO_URI && !process.env.MONGODB_URI) {
  console.error('Missing MongoDB connection string on Vercel. Set MONGO_URI or MONGODB_URI in Vercel environment variables.');
}

const app = express();
app.use(cors());
app.use(express.json());

const fmt = d => d.toISOString().split('T')[0];
const todayStr = () => fmt(new Date());

const { Schema } = mongoose;

const counterSchema = new Schema({
  _id: String,
  seq: { type: Number, default: 1000 },
});
const Counter = mongoose.model('Counter', counterSchema);

const settingSchema = new Schema({
  _id: { type: String, default: 'settings' },
  hotelName: String,
  address: String,
  phone: String,
  email: String,
  currency: String,
  taxRate: Number,
  guestRating: Number,
});
const pricingSchema = new Schema({
  _id: { type: String, default: 'pricing' },
  standard: Number,
  deluxe: Number,
  suite: Number,
  presidential: Number,
  earlyCheckin: Number,
  lateCheckout: Number,
});

const roomSchema = new Schema({
  id: String,
  number: String,
  floor: Number,
  type: String,
  capacity: Number,
  price: Number,
  status: String,
  amenities: String,
});
const guestSchema = new Schema({
  id: String,
  fname: String,
  lname: String,
  email: String,
  phone: String,
  nationality: String,
  idType: String,
  idNum: String,
  stays: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
});
const reservationSchema = new Schema({
  id: String,
  guestId: String,
  guestName: String,
  room: String,
  checkin: String,
  checkout: String,
  nights: Number,
  amount: Number,
  status: String,
  payment: String,
  notes: String,
});
const housekeepingSchema = new Schema({
  id: String,
  room: String,
  type: String,
  staff: String,
  priority: String,
  status: String,
  notes: String,
});
const staffSchema = new Schema({
  id: String,
  fname: String,
  lname: String,
  role: String,
  dept: String,
  shift: String,
  phone: String,
  email: String,
  status: String,
});
const invoiceSchema = new Schema({
  id: String,
  bookingId: String,
  guest: String,
  room: String,
  dates: String,
  amount: Number,
  paid: Number,
  status: String,
});
const activitySchema = new Schema({
  text: String,
  color: String,
  createdAt: { type: Date, default: Date.now },
});

const Setting = mongoose.model('Setting', settingSchema);
const Pricing = mongoose.model('Pricing', pricingSchema);
const Room = mongoose.model('Room', roomSchema);
const Guest = mongoose.model('Guest', guestSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const Housekeeping = mongoose.model('Housekeeping', housekeepingSchema);
const Staff = mongoose.model('Staff', staffSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const Activity = mongoose.model('Activity', activitySchema);

const getNextId = async (prefix, counterName) => {
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `${prefix}${counter.seq}`;
};

const ensureSetting = async () => {
  let settings = await Setting.findById('settings');
  if (!settings) {
    settings = await Setting.create({
      _id: 'settings',
      hotelName: 'LuxeStay Grand Hotel',
      address: '123 Grand Boulevard, New York, NY 10001',
      phone: '+1 (212) 555-0100',
      email: 'info@luxestay.com',
      currency: 'USD ($)',
      taxRate: 10,
      guestRating: 4.6,
    });
  }
  return settings;
};

const ensurePricing = async () => {
  let pricing = await Pricing.findById('pricing');
  if (!pricing) {
    pricing = await Pricing.create({
      _id: 'pricing',
      standard: 120,
      deluxe: 180,
      suite: 350,
      presidential: 650,
      earlyCheckin: 40,
      lateCheckout: 40,
    });
  }
  return pricing;
};

const createActivity = async (text, color) => {
  return Activity.create({ text, color });
};

const getSummary = async () => {
  const totalRooms = await Room.countDocuments();
  const occupiedCount = await Room.countDocuments({ status: 'occupied' });
  const occupancyRate = totalRooms ? Math.round((occupiedCount / totalRooms) * 100) : 0;
  const today = todayStr();
  const checkinsToday = await Reservation.countDocuments({ checkin: today, status: { $ne: 'cancelled' } });
  const reservationToday = await Reservation.find({ $or: [{ checkin: today }, { checkout: today }] });
  const revenueToday = reservationToday.reduce((sum, r) => sum + (r.amount || 0), 0);
  const floors = await Room.distinct('floor');
  const pendingReservations = await Reservation.countDocuments({ status: 'pending' });
  const activity = await Activity.find().sort({ createdAt: -1 }).limit(10);

  return {
    totalRooms,
    occupancyRate,
    occupiedCount,
    floors: floors.length,
    checkinsToday,
    revenueToday,
    pendingReservations,
    activity,
  };
};

const findRoomByNumber = async number => Room.findOne({ number });

app.get('/api/summary', async (req, res) => {
  try {
    const summary = await getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await ensureSetting();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const settings = await Setting.findByIdAndUpdate('settings', req.body, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pricing', async (req, res) => {
  try {
    const pricing = await ensurePricing();
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pricing', async (req, res) => {
  try {
    const pricing = await Pricing.findByIdAndUpdate('pricing', req.body, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { number: new RegExp(search, 'i') },
      { type: new RegExp(search, 'i') },
    ];
    const rooms = await Room.find(filter).sort({ floor: 1, number: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const id = await getNextId('R', 'nextRoomId');
    const room = new Room({ id, ...req.body });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guests', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { email: new RegExp(search, 'i') },
        { fname: new RegExp(search, 'i') },
        { lname: new RegExp(search, 'i') },
      ];
    }
    const guests = await Guest.find(filter).sort({ fname: 1, lname: 1 });
    res.json(guests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/guests', async (req, res) => {
  try {
    const id = await getNextId('G', 'nextGuestId');
    const guest = new Guest({ id, stays: 0, spent: 0, ...req.body });
    await guest.save();
    res.status(201).json(guest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    await Guest.deleteOne({ id: req.params.id });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { guestName: new RegExp(search, 'i') },
        { room: new RegExp(search, 'i') },
        { id: new RegExp(search, 'i') },
      ];
    }
    const reservations = await Reservation.find(filter).sort({ checkin: 1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const payload = req.body;
    const id = await getNextId('BK', 'nextResId');
    const nights = Math.max(1, Math.round((new Date(payload.checkout) - new Date(payload.checkin)) / 86400000));
    const room = await findRoomByNumber(payload.room);
    const amount = room ? room.price * nights : payload.amount || 0;
    const reservation = new Reservation({
      id,
      guestId: payload.guestId || 'G_NEW',
      guestName: payload.guestName,
      room: payload.room,
      checkin: payload.checkin,
      checkout: payload.checkout,
      nights,
      amount,
      status: payload.status || 'confirmed',
      payment: payload.payment || 'Credit Card',
      notes: payload.notes || '',
    });
    await reservation.save();
    if (room && room.status === 'available') {
      room.status = 'reserved';
      await room.save();
    }
    await createActivity(`New reservation ${id} created for ${reservation.guestName}`, 'var(--blue)');
    res.status(201).json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/reservations/:id', async (req, res) => {
  try {
    const reservation = await Reservation.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations/:id/cancel', async (req, res) => {
  try {
    const reservation = await Reservation.findOneAndUpdate({ id: req.params.id }, { status: 'cancelled' }, { new: true });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    await createActivity(`Reservation ${reservation.id} cancelled`, 'var(--red)');
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations/:id/checkin', async (req, res) => {
  try {
    const reservation = await Reservation.findOneAndUpdate({ id: req.params.id }, { status: 'checked-in' }, { new: true });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    const room = await findRoomByNumber(reservation.room);
    if (room) {
      room.status = 'occupied';
      await room.save();
    }
    await createActivity(`${reservation.guestName} checked in to Room ${reservation.room}`, 'var(--green)');
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reservations/:id/checkout', async (req, res) => {
  try {
    const reservation = await Reservation.findOneAndUpdate({ id: req.params.id }, { status: 'checked-out' }, { new: true });
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    const room = await findRoomByNumber(reservation.room);
    if (room) {
      room.status = 'available';
      await room.save();
    }
    const invoiceId = await getNextId('INV', 'nextInvoiceId');
    const invoice = new Invoice({
      id: invoiceId,
      bookingId: reservation.id,
      guest: reservation.guestName,
      room: reservation.room,
      dates: `${reservation.checkin} – ${reservation.checkout}`,
      amount: reservation.amount,
      paid: 0,
      status: 'unpaid',
    });
    await invoice.save();
    await createActivity(`${reservation.guestName} checked out from Room ${reservation.room}`, 'var(--red)');
    res.json({ reservation, invoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/housekeeping', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const tasks = await Housekeeping.find(filter).sort({ id: 1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/housekeeping', async (req, res) => {
  try {
    const id = await getNextId('HK', 'nextHKId');
    const task = new Housekeeping({ id, status: 'pending', ...req.body });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/housekeeping/:id/complete', async (req, res) => {
  try {
    const task = await Housekeeping.findOneAndUpdate({ id: req.params.id }, { status: 'completed' }, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await createActivity(`Room ${task.room} housekeeping completed`, 'var(--green)');
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/housekeeping/:id', async (req, res) => {
  try {
    await Housekeeping.deleteOne({ id: req.params.id });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/staff', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { role: new RegExp(search, 'i') },
        { fname: new RegExp(search, 'i') },
        { lname: new RegExp(search, 'i') },
      ];
    }
    const staff = await Staff.find(filter).sort({ fname: 1, lname: 1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const id = await getNextId('ST', 'nextStaffId');
    const member = new Staff({ id, status: 'active', ...req.body });
    await member.save();
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await Staff.deleteOne({ id: req.params.id });
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ id: 1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const id = await getNextId('INV', 'nextInvoiceId');
    const invoice = new Invoice({ id, paid: 0, status: 'unpaid', ...req.body });
    await invoice.save();
    await createActivity(`Invoice ${id} generated for ${invoice.guest}`, 'var(--gold)');
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/invoices/:id/pay', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    invoice.paid = invoice.amount;
    invoice.status = 'paid';
    await invoice.save();
    await createActivity(`Invoice ${invoice.id} marked as paid`, 'var(--gold)');
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const invoices = await Invoice.find();
    const rooms = await Room.find();
    const reservations = await Reservation.find();
    const monthlyRevenue = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalRooms = rooms.length;
    const occupiedCount = rooms.filter(r => r.status === 'occupied').length;
    const avgOccupancy = totalRooms ? Math.round((occupiedCount / totalRooms) * 100) : 0;
    const totalBookings = reservations.length;
    const avgDailyRate = totalRooms ? Math.round(rooms.reduce((sum, room) => sum + (room.price || 0), 0) / totalRooms) : 0;
    const avgStay = totalBookings ? Math.round(reservations.reduce((sum, r) => sum + (r.nights || 0), 0) / totalBookings) : 0;

    const roomTypes = rooms.reduce((acc, room) => {
      if (!acc[room.type]) acc[room.type] = { type: room.type, count: 0, totalRate: 0, occupied: 0, revenue: 0 };
      acc[room.type].count += 1;
      acc[room.type].totalRate += room.price || 0;
      if (room.status === 'occupied') acc[room.type].occupied += 1;
      return acc;
    }, {});

    const invoiceMap = invoices.reduce((map, inv) => {
      map[inv.room] = (map[inv.room] || 0) + (inv.amount || 0);
      return map;
    }, {});

    const performance = Object.values(roomTypes).map(stat => ({
      type: stat.type,
      count: stat.count,
      avgRate: Math.round(stat.totalRate / stat.count),
      occupancy: stat.count ? Math.round(stat.occupied / stat.count * 100) : 0,
      revenue: rooms.filter(r => r.type === stat.type).reduce((sum, room) => sum + (invoiceMap[room.number] || 0), 0),
    }));

    res.json({ monthlyRevenue, avgOccupancy, totalBookings, avgDailyRate, avgStay, performance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
    if (!process.env.VERCEL) {
      app.listen(port, () => {
        console.log(`LuxeStay backend running on http://localhost:${port}`);
      });
    }
  })
  .catch(error => {
    console.error('MongoDB connection failed:', error.message);
  });

module.exports = app;
