import Joi from 'joi';
import { Item } from '../models/Item.js';

const objectId = Joi.string().hex().length(24);

const createSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  category: Joi.string().valid(
    'electronics',
    'clothing',
    'documents',
    'accessories',
    'other'
  ),
  status: Joi.string().valid('lost', 'found', 'claimed'),
  location: Joi.string(),
  reportedBy: objectId
});

const updateSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string().allow(''),
  category: Joi.string().valid(
    'electronics',
    'clothing',
    'documents',
    'accessories',
    'other'
  ),
  status: Joi.string().valid('lost', 'found', 'claimed'),
  location: Joi.string(),
  reportedBy: objectId
}).min(1); // reject an empty {} body — nothing to update

const listQuerySchema = Joi.object({
  status: Joi.string().valid('lost', 'found', 'claimed'),
  category: Joi.string().valid(
    'electronics',
    'clothing',
    'documents',
    'accessories',
    'other'
  )
});

function publicItem(item) {
  const reportedBy = item.reportedBy
    ? { _id: item.reportedBy._id, name: item.reportedBy.name, email: item.reportedBy.email }
    : null;

  const { _id, title, description, category, status, location, createdAt, updatedAt } = item;
  return { _id, title, description, category, status, location, reportedBy, createdAt, updatedAt };
}

export async function getAllItems(req, res, next) {
  try {
    const { value, error } = listQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // value only contains keys that were actually present (status/category),
    // so this doubles as the Mongo filter — no status means no filter on status.
    const items = await Item.find(value)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email')
      .lean();

    res.json({ items: items.map(publicItem) });
  } catch (err) { next(err); }
}

export async function getItem(req, res, next) {
  try {
    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .lean(); // <-- was `.lean` (no call) — query never ran, see below

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ item: publicItem(item) });
  } catch (err) { next(err); }
}

export async function createItem(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    let item = await Item.create(value);
    item = await item.populate('reportedBy', 'name email');

    res.status(201).json({ item: publicItem(item.toObject()) });
  } catch (err) { next(err); }
}

export async function updateItem(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ item: publicItem(item.toObject()) });
  } catch (err) { next(err); }
}

export async function deleteItem(req, res, next) {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
}