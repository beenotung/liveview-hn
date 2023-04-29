import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('cache'))) {
    await knex.schema.createTable('cache', table => {
      table.increments('id')
      table.text('url').notNullable().unique()
      table.integer('exp').notNullable()
      table.text('data').notNullable()
      table.timestamps(false, true)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cache')
}
