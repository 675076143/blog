# Knex.js TypeScript 友好 (Interface篇)

> 2024-03-14

### 背景

1. Nestjs + knex.js
2. 这个项目只做纯粹的查询，不做增删改
3. 数据表来源外部服务，并且有多个数据库连接
4. 查询复杂度高

\
综上，项目没有考虑使用数据库迁移、ORM框架。大多都是基于knex.js querybuilder完成的

### 起因

先来看这一段代码

![image](../assets/image%20(17).png)

当users为空数组时，这段代码还不会报错。但当users有值，由于仅 `select('id')` 会导致 `users.map(i=>i.name)` 得到 `[undefined,...]`这会引发如下异常:

```typescript
ERROR [ExceptionsHandler] Undefined binding(s) detected when compiling WHERE. Undefined column(s): [user_name] query: where "user_name" in (?)
```

这种低级问题，我们希望在开发阶段就能暴露出来，这就需要借助 TypeScript。\


### 类型推断

knex.js 的类型推导，其实已经做的很不错了，但是需要把表字段写成 interface这样在select阶段可以获得columns的提示

![image](../assets/image%20(18).png)

同时，如果只select其中几个字段，会通过 Pick 的方式自动推断，得到错误提示

![image](../assets/image%20(19).png)

![image](../assets/image%20(21).png)

### 自动生成 Interface

蛋疼的事来了，typescript提示确实不错...但是一个复杂的查询，动辄三张表，每张表几十个字段，select并不会全部用到，光写这个interface，手都要写断了，还有可能写错。项目里的查询已经涉及两百多张表了，要维护这些interface也很头疼。\
为了解决这个重复性工作，这里通过 [ts-morph](https://ts-morph.com/) 直接操作AST, 完成 **database schema** 到 **typescript interface** 的转换

1. #### 增加命令

基于[nest-commander](https://docs.nestjs.com/recipes/nest-commander)，这里不过多介绍，希望命令的使用能够像这样：

```bash
$ node dist/main.js db-interface ods_example.users 表名称 --connection=连接名称
```

自动读取该表的所有字段，并生成对应的 interface, 输出到 `src/db-types/{{连接名称}}/{{表名称}}.ts`

2. #### 读取 Information Schema

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'ods_example'
and "table_name" = 'users';
```

```
column_name | data_type
id          | bigint
name        | character varying
username    | character varying
email       | character varying
```

将这些数据库字段类型，映射成 TypeScript 类型

![image](../assets/image%20(22).png)

3. #### 使用容器内已注入的数据库配置

![image](../assets/image%20(23).png)

![image](../assets/image%20(24).png)

4. #### 通过 ts-morph 生成 Interface

![image](../assets/image%20(25).png)

5. #### 最终效果

![image](../assets/image%20(26).png)

6. #### 语法糖

绑定table名称与类型的映射关系，这样就不需要显式定义。缺点是，当使用了多个数据库链接时，可能存在重名表。在这个项目中，只将使用最频繁的数据库链接里的表，放到declare里。

![](<../assets/image%20(27).png>)

![](<../assets/image%20(28).png>)

![](<../assets/image%20(29).png>)\
\
\
附完整command:

```typescript
import { InjectEntityManager } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/sqlite';
import { Command, CommandRunner, Option } from "nest-commander";

import { Project } from 'ts-morph'

type Type = 'boolean' | 'number' | 'string' | 'array' | 'object' | 'enum' | 'null' | 'any'

const pgColumnTypeMapper: Record<string, Type> = {
  character: 'string',
  bigint: 'number',
  'character varying': 'string',
  smallint: 'number',
  integer: 'number',
  'timestamp without time zone': 'string',
  text: 'string',
  numeric: 'number',
  boolean: 'boolean',
  date: 'string',
  'timestamp with time zone': 'string',
  'double precision': 'number'
}

@Command({
  name: 'db-interface',
  arguments: '<tableSchema>',
  description: 'Generate TypeScript Interface from Database Information Schema'
})
export class DBInterfaceCommand extends CommandRunner {

  constructor(
    @InjectEntityManager('pgsql') private readonly em: EntityManager,
  ) {
    super();
  }

  async run(inputs: string[], options: Record<string, any>): Promise<void> {
    // Prepare Knex Connection
    const connection = options.connection
    const knex = this.em.getConnection().getKnex()

    const [tableSchema] = inputs
    const [schema, table] = tableSchema.split('.')
    console.log('Generating interface:', { schema, table, connection })
    if (!schema || !table) {
      console.warn('Required table schema.')
      return;
    }

    const columns = await knex('information_schema.columns')
      .select('column_name', 'data_type')
      .where('table_schema', schema)
      .where('table_name', table);

    if (columns.length === 0) {
      console.warn('Unknown table schema: ', tableSchema)
      return;
    }

    // Prepare ts-morph
    const project = new Project();
    const filePath = `./src/db-types/${connection}/${schema}/${table}.ts`
    const sourceFile = project.createSourceFile(filePath, '', {
      overwrite: true
    })

    const interfaceName = table.split('_').map(i => i.charAt(0).toUpperCase() + i.slice(1)).join('') + 'Table';
    const interfaceDeclaration = sourceFile.addInterface({
      name: interfaceName,
      isExported: true,
    });
    columns.forEach(column => {
      let type: Type = 'string'
      if (pgColumnTypeMapper[column.data_type]) {
        type = pgColumnTypeMapper[column.data_type]
      } else {
        console.warn('Unknow column data type:', column.data_type)
      }
      interfaceDeclaration.addProperty({
        name: column.column_name,
        type: type,
        hasQuestionToken: false,
      });
    });

    // Save TypeScript files
    project.saveSync();
    console.log('Table interface files generated successfully at:', filePath);
  }

  @Option({
    flags: '-c, --connection <connection>',
    defaultValue: 'pgsql'
  })
  parseConnection(val: string) {
    return val
  }
}
```

### Q\&A

1. #### join 的类型推断

![image](../assets/image%20(30).png)

2. #### ambiguous column name

![image](../assets/image%20(31).png)

3. #### subQuery

使用类型推导， 若为 Knex.QueryBuilder 则将 Awaited 得到的第一个元素作为数据类型

```typescript
export type TableType<T> = T extends Knex.QueryBuilder ? Awaited<T>[0] : T;
```

![image](../assets/image%20(32).png)

### 相关链接

https://ts-morph.com/

https://docs.nestjs.com/recipes/nest-commander

https://supabase.com/docs/guides/api/rest/generating-types
