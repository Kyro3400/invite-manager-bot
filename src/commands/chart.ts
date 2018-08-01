import {
	Command,
	CommandDecorators,
	Logger,
	logger,
	Message,
	Middleware
} from '@yamdbf/core';

import { IMClient } from '../client';
import { joins, sequelize } from '../sequelize';
import { Chart } from '../utils/Chart';
import { CommandGroup, createEmbed, RP, sendEmbed } from '../utils/util';

const { resolve } = Middleware;
const { using, localizable } = CommandDecorators;

export default class extends Command<IMClient> {
	@logger('Command') private readonly _logger: Logger;

	public constructor() {
		super({
			name: 'graph',
			aliases: ['g', 'chart'],
			desc: 'Display graph',
			usage: '<prefix>graph <type>',
			group: CommandGroup.Other,
			guildOnly: true,
			hidden: true
		});
	}

	@using(resolve('type: string'))
	@localizable
	public async action(
		message: Message,
		[rp, type]: [RP, string]
	): Promise<any> {
		this._logger.log(
			`${message.guild.name} (${message.author.username}): ${message.content}`
		);

		const js = await joins.findAll({
			attributes: [
				[sequelize.fn('YEAR', sequelize.col('createdAt')), 'year'],
				[sequelize.fn('MONTH', sequelize.col('createdAt')), 'month'],
				[sequelize.fn('DAY', sequelize.col('createdAt')), 'day'],
				[sequelize.fn('COUNT', 'id'), 'total']
			],
			group: [
				sequelize.fn('YEAR', sequelize.col('createdAt')),
				sequelize.fn('MONTH', sequelize.col('createdAt')),
				sequelize.fn('DAY', sequelize.col('createdAt'))
			],
			where: {
				guildId: message.guild.id
			},
			order: [sequelize.literal('MAX(createdAt)')],
			limit: 60,
			raw: true
		});

		const labels: string[] = [];
		const data: number[] = [];
		js.forEach((j: any) => {
			labels.push(`${j.day}.${j.month}.${j.year}`);
			data.push(Number(j.total));
		});

		let config = {
			labels,
			datasets: [
				{
					label: 'Data',
					borderColor: 'black',
					pointBorderColor: 'black',
					pointBackgroundColor: 'black',
					pointBorderWidth: 0,
					pointRadius: 1,
					fill: true,
					borderWidth: 2,
					data,
					datalabels: {
						align: 'end',
						anchor: 'end'
					}
				}
			]
		};

		if (type !== 'joins') {
			message.channel.send('Invalid export type. Use one of: `joins`');
			return;
		}

		let chart = new Chart();
		chart.getChart('line', config).then((buffer: Buffer) => {
			const embed = createEmbed(this.client);
			embed.setTitle('User Growth');
			embed.setDescription(
				'This chart shows the growth of your server.'
			);
			embed.setImage('attachment://chart.png');
			embed.attachFiles([
				{
					attachment: buffer,
					name: 'chart.png'
				}
			]);

			message.channel.send({ embed }).then(() => {
				chart.destroy();
			});
		});
	}
}