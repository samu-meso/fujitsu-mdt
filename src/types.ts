export type User = { id:string; username:string; alias?:string; email?:string; role:'admin'|'user'; active:number; createdAt:string; updatedAt:string }
export type ReportType = {id:string;name:string;color:string;icon:string;active:number}
export type Dossier = {id:string;publicCode:string;title:string;content:string;status:'bozza'|'aperto'|'chiuso';notes:string;authorId:string;author:string;createdAt:string;updatedAt:string}
export type Report = {pingDurationHours?:24|48|null;id:string;title:string;description:string;eventDate:string;latitude:number;longitude:number;address:string;typeId:string;authorId:string;author:string;dossierId:string|null;createdAt:string;updatedAt:string}
export type Attachment = {id:string;originalName:string;size:number;mimeType:string;createdAt:string;uploadedBy:string;storagePath:string;url:string;downloadUrl:string}
export type Activity = {id:string;author:string;action:string;entityType:string;entityId:string;createdAt:string}
export type Data = {reports:Report[];dossiers:Dossier[];users:User[];types:ReportType[];activity:Activity[];uploadConfig:{maxBytes:number;allowed:string[]}}
export type Kind = 'reports'|'dossiers'
