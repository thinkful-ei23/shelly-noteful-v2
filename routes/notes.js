'use strict';

const express = require('express');

// Create an router instance (aka "mini-app")
const router = express.Router();

// TEMP: Simple In-Memory Database
// const data = require('../db/notes');
// const simDB = require('../db/simDB');
// const notes = simDB.initialize(data);

const knex = require('../knex');

// Get All (and search by query)
router.get('/', (req, res, next) => {
	const { searchTerm } = req.query;
	const { folderId }  = req.query;
	
	knex
		.select('notes.id', 'title', 'content', 'folders.id as folderId', 'folders.name as folderName', 'notes_tags.note_id as noteTagsId', 'tags.id as tagId', 'tags.name as tagName')
		.from('notes')
		.leftJoin('folders', 'notes.folder_id', 'folders.id')
		.leftJoin('notes_tags', 'notes.id', 'notes_tags.note_id')
		.leftJoin('tags', 'notes_tags.tag_id','tags.id' )
		.modify(queryBuilder => {
			if (searchTerm) {
				queryBuilder.where('title', 'like', `%${searchTerm}%`);
			}
		})
		.modify(function(queryBuilder) {
			if(folderId) {
				queryBuilder.where('folder_id', folderId);
			}
		})
		.orderBy('notes.id')
		.then(results => {
			res.json(results);
		})
		.catch(err => {
			next(err);
		});
});

// Get a single item
router.get('/:id', (req, res, next) => {
	const id = req.params.id;

	knex.select('notes.id', 'title', 'content', 'folders.id as folderId', 'folders.name as folderName')
		.from('notes')
		.leftJoin('folders', 'notes.folder_id', 'folders.id')
		.where('notes.id', id)
		.then(result => {
			if (!result) {
				next({status : 404});
			}
			res.json(result);
		})
		.catch(err => {
			next(err);
		});

});

// Put update an item
router.put('/:id', (req, res, next) => {
	const id = req.params.id;

	/***** Never trust users - validate input *****/
	const {title, content, folder_id} = req.body;

	const updateObj = {
		title: title,
		content: content,
		folder_id: folder_id
	};

	const updateableFields = ['title', 'content', 'folderId'];

	updateableFields.forEach(field => {
		if (field in req.body) {
			updateObj[field] = req.body[field];
		}
	});

	/***** Never trust users - validate input *****/
	if (!updateObj.title) {
		const err = new Error('Missing `title` in request body');
		err.status = 400;
		return next(err);
	}
	
	let noteId;

	knex('notes')
		.where('notes.id', id)
		.update(updateObj, ['id'])
		// .returning('id')
		.then(([id]) => {
			noteId = id;
			return knex.select('notes.id', 'title', 'content', 'folder_id', 'folders.name as folder_name')
				.from('notes')
				.leftJoin('folders', 'notes.folder_id', 'folders.id')
				.where('notes.id', noteId);
		}).then(result => {
			res.json(result);
		})
		.catch(err => {
			next(err);
		});
});

// Post (insert) an item
router.post('/', (req, res, next) => {
	const { title, content, folderId } = req.body;

	const newItem = { 
		title: title, 
		content: content,
		folder_id: folderId
	};

	let noteId;

	/***** Never trust users - validate input *****/
	if (!newItem.title) {
		const err = new Error('Missing `title` in request body');
		err.status = 400;
		return next(err);
	}

	knex.insert(newItem)
		.into('notes')
		.returning('id')
		.then(([id]) => {
			noteId = id;
			return knex.select('notes.id', 'title', 'content', 'folder_id as folderId', 'folders.name as folderName')
				.from('notes')
				.leftJoin('folders', 'notes.folder_id', 'folders.id')
				.where('notes.id', noteId);
		}).then(([result]) => {
			res.location(`${req.originalUrl}/${result.id}`).status(201).json(result);
		})
		.catch(err => {
			next(err);
		});
});

// Delete an item
router.delete('/:id', (req, res, next) => {
	const id = req.params.id;

	knex('notes')
		.where('id', id)
		.del()
		.then(result => {
			res.json('deleted');
		})
		.catch(err => {
			next(err);
		});

	// notes.delete(id)
	// 	.then(() => {
	// 		res.sendStatus(204);
	// 	})
	// 	.catch(err => {
	// 		next(err);
	// 	});
});

module.exports = router;
