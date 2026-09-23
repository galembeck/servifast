/** biome-ignore-all lint/style/noNonNullAssertion: always come as string */

import { restaurantSchema } from "@repo/rbac/src/models/restaurant.model";
import { ArrowLeftRight, Crown, UserMinus } from "lucide-react";
import { getMembers } from "@/api/http/services/get-members";
import { getMembership } from "@/api/http/services/get-membership";
import { getRestaurant } from "@/api/http/services/get-restaurant";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ability, getCurrentRestaurant } from "@/providers/auth-provider";
import { removeMemberAction } from "../~actions/actions";
import { UpdateMemberRoleSelect } from "./update-member-role-select";

export async function MembersList() {
	const permissions = await ability();

	const currentRestaurant = await getCurrentRestaurant();

	const [{ membership }, { restaurant }, { members }] = await Promise.all([
		getMembership(currentRestaurant!),
		getRestaurant(currentRestaurant!),
		getMembers(currentRestaurant!),
	]);

	const authRestaurant = restaurantSchema.parse(restaurant);

	return (
		<div className="space-y-2">
			<h2 className="font-semibold text-lg">Funcionários</h2>

			<div className="rounded border">
				<Table>
					<TableBody>
						{members.map((member) => (
							<TableRow key={member.id}>
								<TableCell className="py-2.5" style={{ width: 48 }}>
									<Avatar>
										{member.avatarUrl && (
											<AvatarImage className="h-8 w-8" src={member.avatarUrl} />
										)}

										<AvatarFallback />
									</Avatar>
								</TableCell>

								<TableCell className="py-2.5">
									<div className="flex flex-col">
										<span className="inline-flex items-center gap-2 font-medium">
											{member.name}
											{member.userId === membership.userId && (
												<Badge
													className="font-semibold text-[10px] uppercase"
													variant="secondary"
												>
													EU
												</Badge>
											)}
											{member.userId === restaurant.ownerId && (
												<Badge
													className="inline-flex items-center gap-1 font-semibold text-[10px] text-muted-foreground"
													variant="outline"
												>
													<Crown />
													Dono
												</Badge>
											)}
										</span>

										<span className="text-muted-foreground text-xs">
											{member.email}
										</span>
									</div>
								</TableCell>

								<TableCell className="py-2.5">
									<div className="flex items-center justify-end gap-2">
										{permissions?.can("transfer_ownership", authRestaurant) && (
											<Button
												disabled={
													member.userId === membership.userId ||
													member.userId === restaurant.ownerId
												}
												size="sm"
												variant="outline"
											>
												<ArrowLeftRight className="mr-2 size-4" />
												Transferir liderança
											</Button>
										)}

										<UpdateMemberRoleSelect
											disabled={
												member.userId === membership.userId ||
												member.userId === restaurant.ownerId ||
												permissions?.cannot("update", "User")
											}
											memberId={member.id}
											value={member.role}
										/>

										{permissions?.can("delete", "User") && (
											<form action={removeMemberAction.bind(null, member.id)}>
												<Button
													disabled={
														member.userId === membership.userId ||
														member.userId === restaurant.ownerId
													}
													size="sm"
													type="submit"
													variant="destructive"
												>
													<UserMinus className="mr-2 size-4" />
													Remover
												</Button>
											</form>
										)}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
