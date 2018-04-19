import { Client, Collection, GuildMember, Invite, RichEmbed } from 'discord.js';
import { Guild, GuildStorage } from 'yamdbf';

import { customInvites, inviteCodes, RankInstance, ranks, ActivityAction, activities } from '../sequelize';

export enum CommandGroup {
	Invites = 'Invites',
	Ranks = 'Ranks',
	Admin = 'Admin',
	Other = 'Other',
}

export function createEmbed(client: Client, embed: RichEmbed, color: string = '#00AE86'): RichEmbed {
	embed.setColor(color);
	if (client) {
		embed.setFooter('InviteManager.co', client.user.avatarURL);
	} else {
		embed.setFooter('InviteManager.co');
	}
	embed.setTimestamp();
	return embed;
}

export async function getInviteCounts(guildId: string, memberId: string):
	Promise<{ code: number, custom: number, auto: number, total: number }> {

	const codePromise = inviteCodes.sum('uses', {
		where: {
			guildId: guildId,
			inviterId: memberId,
		},
	});
	const customPromise = customInvites.sum('amount', {
		where: {
			guildId: guildId,
			memberId: memberId,
			generated: false,
		}
	});
	const autoPromise = customInvites.sum('amount', {
		where: {
			guildId: guildId,
			memberId: memberId,
			generated: true,
		}
	});
	const values = await Promise.all([codePromise, customPromise, autoPromise]);
	const code = values[0] || 0;
	const custom = values[1] || 0;
	const auto = values[2] || 0;

	return {
		code,
		custom,
		auto,
		total: code + custom + auto,
	};
}

export async function promoteIfQualified(guild: Guild, member: GuildMember, totalInvites: number) {
	let nextRankName = '';
	let nextRank: RankInstance = null;

	let rolesToAdd: string[] = [];
	const allRanks = await ranks.findAll({
		where: {
			guildId: guild.id,
		},
		raw: true,
	});

	allRanks.forEach(r => {
		let role = guild.roles.get(r.roleId);
		if (role) {
			if (r.numInvites <= totalInvites) { // Rank needs less/equal invites, so we add add role
				if (!member.roles.has(role.id)) {
					rolesToAdd.push(role.id);
				}
			} else { // Rank requires more invites
				if (nextRank) {
					if (r.numInvites < nextRank.numInvites) { // Next rank is the one with lowest invites needed
						nextRank = r;
						nextRankName = role.name;
					}
				} else {
					nextRank = r;
					nextRankName = role.name;
				}
			}
		} else {
			console.log('ROLE DOESNT EXIST');
		}
	});

	if (rolesToAdd.length > 0) {
		if (guild.me.hasPermission('MANAGE_ROLES')) {
			member.addRoles(rolesToAdd);
		} else {
			// TODO: Notify user about the fact that he deserves a promotion, but it
			// cannot be given to him because of missing permissions
		}
	}

	return {
		numRanks: allRanks.length,
		nextRank,
		nextRankName,
	};
}

export function logAction(action: ActivityAction, guildId: string, memberId: string, data: any) {
	return activities.create({
		id: null,
		action,
		guildId,
		memberId,
		data,
	});
}
