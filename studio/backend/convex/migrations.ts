import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { searchText } from "./lib/catalog";
// Operator-invoked after reviewed deployment. No scheduler or automatic execution.
export const backfillClientSearch=internalMutation({
  args:{cursor:v.union(v.string(),v.null())},
  handler:async(ctx,{cursor})=>{
    const result=await ctx.db.query("clients").paginate({cursor,numItems:100});
    let updated=0;
    for(const row of result.page){
      const text=searchText(row.name,row.email);
      if(row.searchText!==text||row.archived===undefined){await ctx.db.patch(row._id,{searchText:text,archived:row.archived??false});updated++;}
    }
    return {scanned:result.page.length,updated,isDone:result.isDone,continueCursor:result.continueCursor};
  },
});
