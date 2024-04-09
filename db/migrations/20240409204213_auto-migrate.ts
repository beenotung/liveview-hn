import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('migrations')

  {
    // alter column (cache.id) to be non-nullable

    let cache_rows = await knex.select('*').from('cache')

    await knex.schema.dropTable('cache')

    if (!(await knex.schema.hasTable('cache'))) {
      await knex.schema.createTable('cache', table => {
        table.increments('id')
        table.text('url').notNullable().unique()
        table.integer('exp').notNullable()
        table.text('data').nullable()
        table.timestamps(false, true)
      })
    }

    for (let row of cache_rows) {
      await knex.insert(row).into('cache')
    }
  }
  await knex.schema.alterTable('url', table => {
    table.unique(['url'])
  })
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('url', table => {
    table.dropUnique(['url'])
  })

  {
    // alter column (cache.id) to be nullable

    let cache_rows = await knex.select('*').from('cache')

    await knex.schema.dropTable('cache')

    if (!(await knex.schema.hasTable('cache'))) {
      await knex.schema.createTable('cache', table => {
        table.increments('id')
        table.text('url').notNullable().unique()
        table.integer('exp').notNullable()
        table.text('data').nullable()
        table.timestamps(false, true)
      })
    }

    for (let row of cache_rows) {
      await knex.insert(row).into('cache')
    }
  }

  if (!(await knex.schema.hasTable('migrations'))) {
    await knex.schema.createTable('migrations', table => {
      table.increments('id')
      table.text('name').notNullable()
      table.text('up').notNullable()
      table.text('down').notNullable()
      table.timestamps(false, true)
    })
  }
}
