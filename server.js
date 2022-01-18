const express = require('express');
const bodyParser = require('body-parser');
const sql = require('./db.js');

const server = express();
const port = 3000;

server.use(bodyParser.urlencoded({ extended: false }));
server.use(bodyParser.json());

//GET

server.get('/', (req, res) => {
  res.send('qna server is online and true');
})

server.get('/qa/questions', async (req, res) => {
  const questions = await sql`
    select
      q.question_id,
      q.question_body,
      q.question_date,
      q.asker_name,
      q.question_helpfulness,
      q.reported,
      json_object_agg (
        answers.answer_id,
        json_build_object(
          'id', answers.answer_id,
          'body', answers.answer_body,
          'date', answer_date,
          'answerer_name', answerer_name,
          'helpfulness', answer_helpfulness,
          'photos', photos
        )
      )  answers
    from questions q
    inner join (
      select
        answers.question_id,
        answers.answer_id,
        answers.answer_body,
        answers.answer_date,
        answers.answerer_name,
        answers.answer_helpfulness,
        json_agg(
          json_build_object(
            'id', answers_photos.photo_id,
            'url', answers_photos.photo_url
          )
        ) photos
      from answers
      inner join answers_photos on (answers.answer_id = answers_photos.answer_id)
      group by answers.answer_id
    ) as answers
    on (q.question_id = answers.question_id)
    where
      product_id = ${req.query.product_id}
      and q.reported = ${false}
    group by q.question_id
    limit ${req.query.count || 5}
  `
  res.send({
    product_id: req.query.product_id,
    results: questions
  });
})

server.get('/qa/questions/:question_id/answers', async (req, res) => {
  const answers = await sql`
      select
        answers.answer_id as answer_id,
        answer_body as body,
        answer_date as date,
        answerer_name,
        answer_helpfulness as helpfulness,
        json_agg(
          json_build_object(
            'id', photos.photo_id,
            'url', photos.photo_url
          )
        ) as photos
      from answers
      inner join answers_photos photos on (answers.answer_id = photos.answer_id)
      where question_id = ${req.params.question_id}
      group by answers.answer_id
    `
    res.send(answers);
})

//POST

server.post('/qa/questions', async (req, res) => {
  console.log('POSTing to questions...');
  await sql`
    insert into questions (
      product_id,
      question_body,
      question_date,
      asker_name,
      asker_email,
      reported,
      question_helpfulness
    )
    values (
      ${req.body.product_id},
      ${req.body.body},
      ${new Date()},
      ${req.body.name},
      ${req.body.email},
      ${false},
      ${0}
    )
  `
  res.sendStatus(201);
})

server.post('/qa/questions/:question_id/answers', async (req, res) => {
  console.log('POSTing to answers...')
  console.log(req.params);
  console.log(req.body);
  const [newAnswer] = await sql`
    insert into answers (
      question_id,
      answer_body,
      answer_date,
      answerer_name,
      answerer_email,
      reported,
      answer_helpfulness
    )
    values (
      ${req.params.question_id},
      ${req.body.body},
      ${new Date()},
      ${req.body.name},
      ${req.body.email},
      ${false},
      ${0}
    )
    returning *
  `
  for (let photo of req.body.photos) {
    console.log(typeof photo);
    await sql`
      insert into answers_photos (
        answer_id,
        photo_url
      )
      values (
        ${newAnswer.answer_id},
        ${photo}
      )
    `
  }

  res.sendStatus(201);
})

//PUT

server.put('/qa/questions/:question_id/:mark', async (req, res) => {
  res.status(204);
  if (req.params.mark === 'helpful') {
    await sql`
      update questions
        set question_helpfulness = question_helpfulness + 1
      where question_id = ${req.params.question_id}
    `
  } else if (req.params.mark === 'report') {
    await sql`
      update questions
        set reported = ${true}
      where question_id = ${req.params.question_id}
    `
  } else {
    res.status(404);
  }
  res.end();
})

server.put('/qa/answers/:answer_id/:mark', async (req, res) => {
  res.status(204);
  if (req.params.mark === 'helpful') {
    await sql`
    update answers
      set answer_helpfulness = answer_helpfulness + 1
    where answer_id = ${req.params.answer_id}
  `
  } else if (req.params.mark === 'report') {
    await sql`
      update answers
        set reported = ${true}
      where answer_id = ${req.params.answer_id}
    `
  } else {
    res.status(404);
  }
  res.end();
})


server.listen(port, () => {
  console.log(`sdc6 qna server.js now listening at port ${port}...`)
})