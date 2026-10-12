import type {ButtonHTMLAttributes} from "react";
import {cn} from "../../lib/utils";
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"ghost"|"soft"};
export function Button({className,variant="ghost",...props}:Props){return <button className={cn("button",`button-${variant}`,className)} {...props}/>}